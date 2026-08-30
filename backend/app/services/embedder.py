from abc import ABC, abstractmethod
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import settings

class BaseEmbedder(ABC):
    """Abstract base embedder interface for pluggable vector encoding services."""
    @abstractmethod
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        pass

    @abstractmethod
    def embed_query(self, query: str) -> List[float]:
        pass

class EmbedderService(BaseEmbedder):
    """
    Cloud-Native Google Gemini Embedding Service (models/gemini-embedding-001).
    0 MB RAM, 0% CPU footprint on cloud containers (Render).
    Outputs 3072-dimensional embeddings directly to Pinecone Cloud.
    """
    def __init__(self, model_name: str = "models/gemini-embedding-001"):
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def embeddings(self) -> Embeddings:
        """Lazy-loads Google Gemini Embeddings with API key."""
        if self._embeddings is None:
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model=self.model_name,
                google_api_key=settings.GEMINI_API_KEY
            )
            print(f"✅ Embedding Engine: Active Google Gemini ({self.model_name})")
        return self._embeddings

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generates dense vector embeddings for a list of document chunk texts."""
        return self.embeddings.embed_documents(texts)

    def embed_query(self, query: str) -> List[float]:
        """Generates a dense vector embedding for a single search query."""
        return self.embeddings.embed_query(query)

    def get_langchain_embeddings(self) -> Embeddings:
        """Returns the underlying LangChain Embeddings object for direct VectorStore binding."""
        return self.embeddings

