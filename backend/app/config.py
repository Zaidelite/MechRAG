import os
from pathlib import Path
from pydantic_settings import BaseSettings

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_ENV = ROOT_DIR / ".env"
BACKEND_ENV = ROOT_DIR / "backend" / ".env"

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "mech-rag"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    CHROMA_PERSIST_DIR: str = "./data/chroma_db"
    UPLOAD_DIR: str = "./data/uploads"

    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    LLM_MODEL: str = "qwen/qwen3.6-27b"

    TOP_K_RETRIEVAL: int = 15
    TOP_K_RERANK: int = 6
    CHUNK_SIZE: int = 1100
    CHUNK_OVERLAP: int = 150

    class Config:
        env_file = [str(ROOT_ENV), str(BACKEND_ENV), ".env"]
        extra = "ignore"

settings = Settings()

