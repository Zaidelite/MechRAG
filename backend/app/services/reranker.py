from typing import List, Dict, Any
from langchain_core.documents import Document

def is_toc_page(doc: Document) -> bool:
    """Detects if document chunk is from front-matter Table of Contents or Index."""
    page = doc.metadata.get("page_number") or doc.metadata.get("page") or 999
    content = doc.page_content
    content_lower = content.lower()
    if page < 30 and ("contents" in content_lower or "chapter 1" in content_lower or "chapter 2" in content_lower):
        return True
    if content.count("....") > 3 or content.count(". . .") > 3 or content.count("----") > 3:
        return True
    return False

class RerankerService:
    """
    Hybrid Reciprocal Rank Fusion (RRF) Reranker Service.
    Combines dense vector similarity rankings with sparse BM25 keyword rankings
    for high precision mechanical engineering equation & terminology retrieval.
    """
    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k

    def reciprocal_rank_fusion(
        self,
        vector_docs: List[Document],
        bm25_docs: List[Document],
        top_n: int = 6
    ) -> List[Document]:
        """
        Combines two ranked lists of Document objects using Reciprocal Rank Fusion formula:
        RRF_Score(d) = 1 / (k + rank_vector(d)) + 1 / (k + rank_bm25(d))
        """
        # Filter out Table of Contents pages
        filtered_vector = [d for d in vector_docs if not is_toc_page(d)]
        filtered_bm25 = [d for d in bm25_docs if not is_toc_page(d)]

        if not filtered_vector:
            filtered_vector = vector_docs
        if not filtered_bm25:
            filtered_bm25 = bm25_docs

        doc_scores: Dict[str, float] = {}
        doc_map: Dict[str, Document] = {}

        # 1. Score dense vector documents
        for rank, doc in enumerate(filtered_vector, start=1):
            content_key = doc.page_content.strip()
            doc_map[content_key] = doc
            doc_scores[content_key] = doc_scores.get(content_key, 0.0) + (1.0 / (self.rrf_k + rank))

        # 2. Score sparse BM25 documents
        for rank, doc in enumerate(filtered_bm25, start=1):
            content_key = doc.page_content.strip()
            doc_map[content_key] = doc
            doc_scores[content_key] = doc_scores.get(content_key, 0.0) + (1.0 / (self.rrf_k + rank))

        # 3. Sort documents by combined RRF score descending
        sorted_keys = sorted(doc_scores.keys(), key=lambda k: doc_scores[k], reverse=True)

        reranked_docs = []
        for key in sorted_keys[:top_n]:
            doc = doc_map[key]
            meta = dict(doc.metadata or {})
            meta["rrf_score"] = round(doc_scores[key], 6)
            reranked_docs.append(Document(
                page_content=doc.page_content,
                metadata=meta
            ))

        return reranked_docs

