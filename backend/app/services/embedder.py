from abc import ABC, abstractmethod
from typing import List
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings

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
    100% Local Embedding Service using HuggingFace sentence-transformers.
    Default model: 'BAAI/bge-small-en-v1.5' (384-dimensional dense vectors).
    Zero API cost, fast CPU inference with on-demand lazy loading.
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def embeddings(self) -> Embeddings:
        """Lazy-loads HuggingFaceEmbeddings only when actually required for indexing or queries."""
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(
                model_name=self.model_name,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True}
            )
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

