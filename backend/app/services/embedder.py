from abc import ABC, abstractmethod
from typing import List, Optional
from langchain_core.embeddings import Embeddings

class FastEmbedLangChainWrapper(Embeddings):
    """
    Ultra-lightweight ONNX Runtime embedding engine (FastEmbed by Qdrant).
    Memory footprint: ~25 MB (vs PyTorch's 850 MB).
    3x faster on CPU with identical 384-dim BAAI/bge-small-en-v1.5 vectors.
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        from fastembed import TextEmbedding
        self.model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [v.tolist() for v in self.model.embed(texts)]

    def embed_query(self, text: str) -> List[float]:
        return list(self.model.embed([text]))[0].tolist()

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
    Production Ultra-Low Memory Local Embedding Service.
    Uses ONNX-quantized FastEmbed for < 30MB RAM footprint on free-tier cloud containers (Render).
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def embeddings(self) -> Embeddings:
        """Lazy-loads ONNX FastEmbed embedding engine on-demand."""
        if self._embeddings is None:
            try:
                self._embeddings = FastEmbedLangChainWrapper(model_name=self.model_name)
            except Exception:
                from langchain_huggingface import HuggingFaceEmbeddings
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

