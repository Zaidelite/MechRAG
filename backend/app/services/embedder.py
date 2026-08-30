from abc import ABC, abstractmethod
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from app.config import settings

class FastEmbedLangChainWrapper(Embeddings):
    """
    Ultra-lightweight local ONNX Runtime embedding engine (FastEmbed by Qdrant).
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
    Production Hybrid Embedding Service.
    Priority 1: Google Gemini Embedding API (models/text-embedding-004) -> 0 MB RAM, 0% CPU, instant.
    Priority 2 (Fallback): Local ONNX FastEmbed (BAAI/bge-small-en-v1.5) -> Pre-cached in Docker, <25MB RAM.
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def embeddings(self) -> Embeddings:
        """Lazy-loads embedding engine prioritizing Google Gemini with FastEmbed local fallback."""
        if self._embeddings is None:
            # 1. Try Google Gemini Embeddings first (0 MB RAM, uses existing GEMINI_API_KEY)
            if settings.GEMINI_API_KEY:
                try:
                    from langchain_google_genai import GoogleGenerativeAIEmbeddings
                    self._embeddings = GoogleGenerativeAIEmbeddings(
                        model="models/text-embedding-004",
                        google_api_key=settings.GEMINI_API_KEY
                    )
                    print("✅ Embedding Engine: Using Google Gemini (models/text-embedding-004)")
                    return self._embeddings
                except Exception as e:
                    print(f"⚠️ Gemini Embedding init failed, falling back to local FastEmbed: {e}")

            # 2. Local ONNX FastEmbed fallback (Pre-cached in Docker, 0 network downloads)
            try:
                self._embeddings = FastEmbedLangChainWrapper(model_name=self.model_name)
                print("✅ Embedding Engine: Using Local ONNX FastEmbed (BAAI/bge-small-en-v1.5)")
            except Exception as e:
                print(f"⚠️ FastEmbed init failed, falling back to SentenceTransformers: {e}")
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

