import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_chroma import Chroma
from app.services.embedder import EmbedderService

# Base directory setup
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_CHROMA_DIR = str(BASE_DIR / "data" / "chroma_db")

class RetrieverService:
    """
    Production Vector Storage & Retrieval Service using persistent ChromaDB.
    Supports similarity search, metadata filtering (filename, book_title), batch indexing, and deletion.
    """
    def __init__(self, persist_dir: Optional[str] = None, collection_name: str = "mech_textbooks", embedder_service: Optional[EmbedderService] = None):
        self.persist_dir = persist_dir or DEFAULT_CHROMA_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        
        self.embedder_service = embedder_service or EmbedderService()
        self.collection_name = collection_name
        self._vector_store: Optional[Chroma] = None

    @property
    def vector_store(self) -> Chroma:
        """Lazy-loads persistent ChromaDB on-demand to ensure fast, low-memory server boot."""
        if self._vector_store is None:
            self._vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embedder_service.get_langchain_embeddings(),
                persist_directory=self.persist_dir
            )
        return self._vector_store

    def add_documents(self, documents: List[Document]) -> int:
        """Indexes batch chunk Document objects into persistent ChromaDB."""
        if not documents:
            return 0
        self.vector_store.add_documents(documents)
        return len(documents)

    def similarity_search(self, query: str, top_k: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Document]:
        """Queries ChromaDB vector collection for top_k relevant chunk Documents."""
        kwargs = {}
        if filters:
            kwargs["filter"] = filters
        return self.vector_store.similarity_search(query, k=top_k, **kwargs)

    def as_langchain_retriever(self, top_k: int = 10, filters: Optional[Dict[str, Any]] = None) -> BaseRetriever:
        """Returns standard LangChain VectorStoreRetriever for LCEL chains."""
        search_kwargs = {"k": top_k}
        if filters:
            search_kwargs["filter"] = filters
        return self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs=search_kwargs
        )

    def delete_by_filename(self, filename: str) -> bool:
        """Purges vector embeddings matching specific document filename metadata from ChromaDB."""
        try:
            # Query matching IDs via metadata filter
            results = self.vector_store.get(where={"filename": filename})
            ids = results.get("ids", [])
            if ids:
                self.vector_store.delete(ids=ids)
                return True
            return False
        except Exception as e:
            print(f"⚠️ Error deleting document vectors from ChromaDB: {e}")
            return False

