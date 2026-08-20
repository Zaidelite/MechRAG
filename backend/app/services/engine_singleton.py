"""
Shared RAG Engine Singleton.
Provides a single RAGEngine instance shared across all routers to avoid
duplicate model loading and circular imports.
"""

from app.services.rag_engine import RAGEngine

# Single shared instance — imported by upload.py, query.py, documents.py
rag_engine = RAGEngine()
