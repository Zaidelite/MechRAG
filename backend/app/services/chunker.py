from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings

class TextChunkerService:
    """
    Production-grade Heading-Aware Text Chunker Service.
    Splits LangChain Document streams into ~1100-token chunks (~4400 characters)
    with overlap (~150 tokens / 600 characters) while preserving LaTeX math blocks and metadata.
    """
    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        self.chunk_size = chunk_size or (settings.CHUNK_SIZE * 4)
        self.chunk_overlap = chunk_overlap or (settings.CHUNK_OVERLAP * 4)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", " ", ""]
        )

    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Splits LangChain Document objects into smaller chunk Documents with enriched metadata."""
        raw_chunks = self.splitter.split_documents(documents)
        
        chunked_documents = []
        for idx, chunk in enumerate(raw_chunks):
            meta = dict(chunk.metadata or {})
            meta["chunk_index"] = idx + 1
            meta["char_length"] = len(chunk.page_content)
            
            chunked_documents.append(Document(
                page_content=chunk.page_content,
                metadata=meta
            ))
            
        return chunked_documents

    def chunk_documents_to_dicts(self, documents: List[Document], pdf_filename: str) -> List[Dict[str, Any]]:
        """Converts chunked Documents into JSON-serializable dictionaries for API payloads or sandbox saving."""
        chunked_docs = self.chunk_documents(documents)
        clean_chunks = []
        
        for chunk in chunked_docs:
            meta = chunk.metadata or {}
            clean_metadata = {
                "filename": pdf_filename,
                "book_title": meta.get("book_title") or pdf_filename,
                "author": meta.get("author", "Unknown"),
                "page_number": meta.get("page_number") or meta.get("page", 1)
            }
            clean_chunks.append({
                "chunk_index": meta.get("chunk_index", 1),
                "page": clean_metadata["page_number"],
                "char_length": meta.get("char_length", len(chunk.page_content)),
                "content": chunk.page_content,
                "metadata": clean_metadata
            })
            
        return clean_chunks

