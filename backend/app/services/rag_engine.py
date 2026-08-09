import os
from typing import Optional, Dict, Any, List
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever

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
from app.schemas.rag_schemas import QueryResponse

class RAGEngine:
    """
    Master RAG Engine Pipeline Orchestrator.
    Connects ingestion, chunking, embedding, vector storage, hybrid RRF reranking, system prompt building, Gemini LLM inference, and citation formatting.
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

    def query(self, query_text: str, top_k_vector: int = 10, top_n_rerank: int = 4, filters: Optional[Dict[str, Any]] = None) -> QueryResponse:
        """High-level query pipeline: Vector Search + BM25 -> RRF Reranking -> System Prompt -> Gemini LLM -> Citation Output."""
        # 1. Dense Vector Similarity Search
        vector_docs = self.retriever.similarity_search(query_text, top_k=top_k_vector, filters=filters)

        # 2. Sparse BM25 Keyword Search
        bm25_docs = []
        if self._bm25_retriever:
            try:
                bm25_docs = self._bm25_retriever.invoke(query_text)[:top_k_vector]
            except Exception:
                bm25_docs = []

        # Fallback if BM25 not available
        if not bm25_docs:
            bm25_docs = vector_docs

        # 3. Reciprocal Rank Fusion (RRF) Reranking
        top_context_docs = self.reranker.reciprocal_rank_fusion(
            vector_docs=vector_docs,
            bm25_docs=bm25_docs,
            top_n=top_n_rerank
        )

        # 4. Format Context & System Prompt
        formatted_context = self.prompt_builder.format_context_documents(top_context_docs)
        prompt_value = self.prompt_builder.get_prompt_template().format_prompt(
            context=formatted_context,
            query=query_text
        )

        # 5. Invoke Gemini LLM
        llm_response = self.llm.generate_response(prompt_value.to_string())

        # 6. Format Citations
        citations = self.citation.format_citations(top_context_docs)

        return QueryResponse(
            query=query_text,
            answer=llm_response,
            citations=citations
        )
