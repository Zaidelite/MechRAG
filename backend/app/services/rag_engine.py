import os
from typing import Optional, Dict, Any, List
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever

from app.config import settings
from app.services.indexing_state import (
    init_db,
    compute_hash,
    find_by_hash,
    register_document,
    update_status,
    update_metadata,
    get_document
)
from app.services.parser import PDFParserService
from app.services.chunker import TextChunkerService
from app.services.embedder import EmbedderService
from app.services.retriever import RetrieverService
from app.services.reranker import RerankerService
from app.services.prompt_builder import PromptBuilderService
from app.services.llm import LLMService
from app.services.citation import CitationService
from app.services.query_router import QueryRouterService
from app.schemas.rag_schemas import QueryResponse

class RAGEngine:
    """
    Master RAG Engine Pipeline Orchestrator.
    Connects ingestion, chunking, embedding, vector storage, hybrid RRF reranking, intelligent query routing, system prompt building, Gemini LLM inference, and citation formatting.
    """
    def __init__(self, chroma_dir: Optional[str] = None):
        init_db()
        self.parser = PDFParserService()
        self.chunker = TextChunkerService()
        self.embedder = EmbedderService()
        self.retriever = RetrieverService(persist_dir=chroma_dir, embedder_service=self.embedder)
        self.reranker = RerankerService()
        self.prompt_builder = PromptBuilderService()
        self.llm = LLMService()
        self.citation = CitationService()
        self.query_router = QueryRouterService(llm_service=self.llm)
        
        # In-memory document chunk store for BM25 sparse keyword retrieval
        self._cached_chunks: List[Document] = []
        self._bm25_retriever: Optional[BM25Retriever] = None

    def ingest_pdf(self, pdf_path: str, max_pages: Optional[int] = None, force_reindex: bool = False) -> Dict[str, Any]:
        """Full document ingestion pipeline: SHA256 dedup -> PyMuPDF LaTeX parse -> 800-token chunk -> ChromaDB vector index -> SQLite state update."""
        filename = os.path.basename(pdf_path)
        sha256 = compute_hash(pdf_path)

        # 0. Deduplication check
        existing = find_by_hash(sha256)
        chroma_check = self.retriever.vector_store.get(where={"filename": filename})
        has_chroma_vectors = bool(chroma_check and chroma_check.get("ids"))

        if existing and existing.get("status") == "done" and has_chroma_vectors and not force_reindex:
            return {
                "document_id": existing["document_id"],
                "filename": filename,
                "status": "done",
                "is_duplicate": True,
                "message": "Document already indexed in database (SHA256 match). Skipped re-ingestion."
            }

        if existing:
            doc_id = existing["document_id"]
            update_status(doc_id, "pending")
        else:
            doc_id = register_document(filename=filename, filepath=pdf_path, sha256=sha256)

        try:
            # 1. Parse PDF
            update_status(doc_id, "parsing")
            page_docs = self.parser.parse_pdf(pdf_path, max_pages=max_pages)
            if not page_docs:
                update_status(doc_id, "failed", error_message="No content extracted from PDF")
                return {"document_id": doc_id, "status": "failed", "error": "No content extracted"}

            first_meta = page_docs[0].metadata or {}
            update_metadata(
                doc_id,
                book_title=first_meta.get("book_title") or filename,
                author=first_meta.get("author") or "Unknown",
                total_pages=len(page_docs)
            )

            # 2. Chunk Documents
            update_status(doc_id, "embedding")
            chunk_docs = self.chunker.chunk_documents(page_docs)

            # 3. Vector Indexing into ChromaDB
            indexed_count = self.retriever.add_documents(chunk_docs)

            # 4. Cache chunks for sparse BM25 retrieval
            self._cached_chunks.extend(chunk_docs)
            if self._cached_chunks:
                self._bm25_retriever = BM25Retriever.from_documents(self._cached_chunks)

            # 5. Mark as DONE
            update_status(doc_id, "done")
            return {
                "document_id": doc_id,
                "filename": filename,
                "status": "done",
                "total_pages": len(page_docs),
                "chunks_indexed": indexed_count,
                "is_duplicate": False,
                "message": f"Successfully parsed and indexed {len(page_docs)} pages ({indexed_count} chunks)."
            }

        except Exception as e:
            update_status(doc_id, "failed", error_message=str(e))
            raise e

    def _get_search_query(self, query_text: str, history: Optional[List[Dict[str, str]]] = None) -> str:
        """Contextualizes search query for retrieval when history contains previous turns."""
        if not history:
            return query_text

        user_turns = [t.get("content", "") for t in history if t.get("role") == "user" and t.get("content")]
        if not user_turns:
            return query_text

        last_user_query = user_turns[-1]
        pronouns = {"it", "its", "this", "that", "these", "they", "them", "his", "her", "the"}
        words = set(query_text.lower().split())
        
        # If query is short or contains follow-up pronouns/references
        if len(query_text.split()) <= 7 or not words.isdisjoint(pronouns):
            return f"{last_user_query} {query_text}"
        return query_text

    def query(
        self,
        query_text: str,
        history: Optional[List[Dict[str, str]]] = None,
        top_k_vector: Optional[int] = None,
        top_n_rerank: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
        model_name: Optional[str] = None
    ) -> QueryResponse:
        """High-level query pipeline with intent classification, multi-turn history, hybrid search, RRF reranking, and citation formatting."""
        # 0. Intelligent Intent Classification
        intent = self.query_router.classify_intent(query_text=query_text, history=history, model_name=model_name)

        if intent == "DIRECT_ANSWER":
            prompt_messages = self.prompt_builder.build_direct_chat_messages(query=query_text, history=history)
            llm_response = self.llm.generate_response(prompt_messages, model_name=model_name)
            return QueryResponse(
                query=query_text,
                answer=llm_response,
                citations=[]
            )

        k_vector = top_k_vector or settings.TOP_K_RETRIEVAL
        n_rerank = top_n_rerank or settings.TOP_K_RERANK

        search_query = self._get_search_query(query_text, history)

        # 1. Dense Vector Similarity Search
        vector_docs = self.retriever.similarity_search(search_query, top_k=k_vector, filters=filters)

        # 2. Sparse BM25 Keyword Search
        bm25_docs = []
        if self._bm25_retriever:
            try:
                bm25_docs = self._bm25_retriever.invoke(search_query)[:k_vector]
            except Exception:
                bm25_docs = []

        # Fallback if BM25 not available
        if not bm25_docs:
            bm25_docs = vector_docs

        # 3. Reciprocal Rank Fusion (RRF) Reranking
        top_context_docs = self.reranker.reciprocal_rank_fusion(
            vector_docs=vector_docs,
            bm25_docs=bm25_docs,
            top_n=n_rerank
        )

        # 4. Format Context & System Prompt Messages with History
        target_model = model_name or settings.LLM_MODEL
        max_chars = 6000 if target_model and not target_model.startswith("gemini") else 24000
        formatted_context = self.prompt_builder.format_context_documents(top_context_docs, max_total_chars=max_chars)
        prompt_messages = self.prompt_builder.build_prompt_messages(
            formatted_context=formatted_context,
            query=query_text,
            history=history
        )

        # 5. Invoke LLM
        llm_response = self.llm.generate_response(prompt_messages, model_name=model_name)

        # 6. Format Citations
        citations = self.citation.format_citations(top_context_docs)

        return QueryResponse(
            query=query_text,
            answer=llm_response,
            citations=citations
        )

    def query_stream(
        self,
        query_text: str,
        history: Optional[List[Dict[str, str]]] = None,
        top_k_vector: Optional[int] = None,
        top_n_rerank: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
        model_name: Optional[str] = None
    ):
        """Streaming query pipeline with intent routing, multi-turn history, hybrid search, RRF reranking, and token SSE output."""
        import json

        # 0. Intelligent Intent Classification
        intent = self.query_router.classify_intent(query_text=query_text, history=history, model_name=model_name)

        if intent == "DIRECT_ANSWER":
            prompt_messages = self.prompt_builder.build_direct_chat_messages(query=query_text, history=history)
            # Emit empty citations event
            yield f"data: {json.dumps({'type': 'citations', 'citations': [], 'data': []})}\n\n"
            # Stream tokens directly from LLM
            for token in self.llm.stream_response(prompt_messages, model_name=model_name):
                yield f"data: {json.dumps({'type': 'token', 'content': token, 'data': token})}\n\n"
            yield "data: [DONE]\n\n"
            return

        k_vector = top_k_vector or settings.TOP_K_RETRIEVAL
        n_rerank = top_n_rerank or settings.TOP_K_RERANK

        search_query = self._get_search_query(query_text, history)

        # 1. Dense Vector Similarity Search
        vector_docs = self.retriever.similarity_search(search_query, top_k=k_vector, filters=filters)

        # 2. Sparse BM25 Keyword Search
        bm25_docs = []
        if self._bm25_retriever:
            try:
                bm25_docs = self._bm25_retriever.invoke(search_query)[:k_vector]
            except Exception:
                bm25_docs = []

        if not bm25_docs:
            bm25_docs = vector_docs

        # 3. Reciprocal Rank Fusion (RRF) Reranking
        top_context_docs = self.reranker.reciprocal_rank_fusion(
            vector_docs=vector_docs,
            bm25_docs=bm25_docs,
            top_n=n_rerank
        )

        # 4. Format Context & System Prompt Messages with History
        target_model = model_name or settings.LLM_MODEL
        max_chars = 6000 if target_model and not target_model.startswith("gemini") else 24000
        formatted_context = self.prompt_builder.format_context_documents(top_context_docs, max_total_chars=max_chars)
        prompt_messages = self.prompt_builder.build_prompt_messages(
            formatted_context=formatted_context,
            query=query_text,
            history=history
        )

        # 5. Format Citations & send first event
        citations_objs = self.citation.format_citations(top_context_docs)
        citations_data = [c.dict() for c in citations_objs]

        yield f"data: {json.dumps({'type': 'citations', 'citations': citations_data, 'data': citations_data})}\n\n"

        # 6. Stream tokens from LLM
        for token in self.llm.stream_response(prompt_messages, model_name=model_name):
            yield f"data: {json.dumps({'type': 'token', 'content': token, 'data': token})}\n\n"

        yield "data: [DONE]\n\n"
