from typing import List
from langchain_core.documents import Document
from app.schemas.rag_schemas import CitationSchema

class CitationService:
    """
    Citation Formatter Service.
    Transforms retrieved LangChain Document objects into structured CitationSchema objects.
    """
    def __init__(self):
        pass

    def format_citations(self, documents: List[Document]) -> List[CitationSchema]:
        """Converts retrieved context Document objects into a list of CitationSchema objects."""
        citations = []
        for doc in documents:
            meta = doc.metadata or {}
            book_title = meta.get("book_title") or meta.get("filename", "Textbook")
            chapter = meta.get("chapter") or f"Page {meta.get('page_number', '?')}"
            page_number = int(meta.get("page_number") or meta.get("page", 1))
            snippet = doc.page_content[:300].strip() + ("..." if len(doc.page_content) > 300 else "")
            score = float(meta.get("rrf_score") or meta.get("similarity_score", 0.95))

            citations.append(CitationSchema(
                book_title=book_title,
                chapter=chapter,
                page_number=page_number,
                text_snippet=snippet,
                diagram_url=meta.get("diagram_url"),
                similarity_score=score
            ))

        return citations

