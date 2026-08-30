import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.vectorstores import VectorStore
from app.config import settings
from app.services.embedder import EmbedderService

# Base directory setup
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_CHROMA_DIR = str(BASE_DIR / "data" / "chroma_db")

class RetrieverService:
    """
    Production Vector Storage & Retrieval Service.
    Priority 1: Pinecone Cloud Vector Database (serverless, persistent, shared across dev & cloud).
    Priority 2: Local ChromaDB (offline fallback).
    """
    def __init__(self, persist_dir: Optional[str] = None, collection_name: str = "mech_textbooks", embedder_service: Optional[EmbedderService] = None):
        self.persist_dir = persist_dir or DEFAULT_CHROMA_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        
        self.embedder_service = embedder_service or EmbedderService()
        self.collection_name = collection_name
        self._vector_store: Optional[VectorStore] = None
        self._is_pinecone: bool = False

    @property
    def vector_store(self) -> VectorStore:
        """Lazy-loads Pinecone Cloud Vector Store if PINECONE_API_KEY is configured, else falls back to ChromaDB."""
        if self._vector_store is None:
            if settings.PINECONE_API_KEY:
                try:
                    from langchain_pinecone import PineconeVectorStore
                    from pinecone import Pinecone
                    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
                    index_name = settings.PINECONE_INDEX_NAME or "mech-rag"
                    existing_names = [idx.name for idx in pc.list_indexes()]
                    if index_name in existing_names:
                        self._vector_store = PineconeVectorStore(
                            index=pc.Index(index_name),
                            embedding=self.embedder_service.get_langchain_embeddings()
                        )
                        self._is_pinecone = True
                        print(f"✅ Vector Store: Connected to Pinecone Cloud (Index: '{index_name}')")
                        return self._vector_store
                    else:
                        print(f"⚠️ Pinecone index '{index_name}' not found (Available: {existing_names}). Using local ChromaDB.")
                except Exception as e:
                    print(f"⚠️ Pinecone connection check failed, using local ChromaDB: {e}")

            # Fallback to persistent local ChromaDB
            try:
                from langchain_chroma import Chroma
                self._vector_store = Chroma(
                    collection_name=self.collection_name,
                    embedding_function=self.embedder_service.get_langchain_embeddings(),
                    persist_directory=self.persist_dir
                )
                print("✅ Vector Store: Connected to local ChromaDB")
            except ImportError:
                print("⚠️ ChromaDB not installed. Operating with Cloud Vector Store.")
        return self._vector_store

    def add_documents(self, documents: List[Document]) -> int:
        """Indexes batch chunk Document objects into Pinecone / ChromaDB."""
        if not documents:
            return 0
        self.vector_store.add_documents(documents)
        return len(documents)

    def similarity_search(self, query: str, top_k: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Document]:
        """Queries Pinecone / ChromaDB vector store for top_k relevant chunk Documents."""
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
        """Purges vector embeddings matching specific document filename metadata."""
        try:
            if self._is_pinecone:
                self.vector_store.delete(filter={"filename": filename})
                return True
            else:
                results = self.vector_store.get(where={"filename": filename})
                ids = results.get("ids", [])
                if ids:
                    self.vector_store.delete(ids=ids)
                    return True
                return False
        except Exception as e:
            print(f"⚠️ Error deleting document vectors: {e}")
            return False

