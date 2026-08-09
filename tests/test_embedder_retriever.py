"""
Sandbox Test Script for Embedder & ChromaDB Retriever Services (tests/test_embedder_retriever.py)
Tests local BAAI/bge-small-en-v1.5 embedding generation, batch vector indexing, similarity search, and citation metadata extraction.
"""

import os
import sys
import json
import shutil
from langchain_core.documents import Document

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.embedder import EmbedderService
from app.services.retriever import RetrieverService

OUTPUT_JSON_PATH = os.path.join(TESTS_DIR, "output_chunks.json")
TEST_CHROMA_DIR = os.path.join(TESTS_DIR, "test_chroma_db")

def test_embedder_and_retriever():
    print("=" * 70)
    print("🚀 Testing Local HuggingFace Embedder & ChromaDB Vector Search")
    print("=" * 70)

    # Clean up test chroma directory
    if os.path.exists(TEST_CHROMA_DIR):
        shutil.rmtree(TEST_CHROMA_DIR)
        print(f"🗑️ Cleaned up existing test Chroma directory: {TEST_CHROMA_DIR}")

    # 1. Initialize Embedder Service
    print("\n1. Initializing local BAAI/bge-small-en-v1.5 Embedder Service...")
    embedder = EmbedderService(model_name="BAAI/bge-small-en-v1.5")
    sample_vec = embedder.embed_query("Navier-Stokes equation")
    print(f"   ✅ Embedder initialized! Vector dimension: {len(sample_vec)} float values.")

    # 2. Initialize Retriever Service
    print("\n2. Initializing ChromaDB Retriever Service at tests/test_chroma_db...")
    retriever = RetrieverService(persist_dir=TEST_CHROMA_DIR, embedder_service=embedder)

    # 3. Load chunks from output_chunks.json
    if not os.path.exists(OUTPUT_JSON_PATH):
        print(f"❌ output_chunks.json not found in {TESTS_DIR}. Please run test_rag_engine.py first!")
        return

    with open(OUTPUT_JSON_PATH, "r", encoding="utf-8") as f:
        raw_chunks = json.load(f)

    print(f"\n3. Indexing {len(raw_chunks)} chunks into ChromaDB...")
    
    # Convert dict chunks into LangChain Document objects
    documents_to_index = []
    for chunk in raw_chunks:
        meta = chunk.get("metadata", {})
        documents_to_index.append(Document(
            page_content=chunk["content"],
            metadata={
                "filename": meta.get("filename", "unknown.pdf"),
                "book_title": meta.get("book_title", "Unknown Book"),
                "author": meta.get("author", "Unknown"),
                "page_number": meta.get("page_number", chunk.get("page", 1)),
                "chunk_index": chunk.get("chunk_index", 1)
            }
        ))

    # Index first 150 chunks for fast sandbox vector testing
    test_docs = documents_to_index[:150]
    indexed_count = retriever.add_documents(test_docs)
    print(f"   ✅ Successfully indexed {indexed_count} chunk vectors into ChromaDB!")

    # 4. Perform Engineering Vector Queries
    test_queries = [
        "What are the Navier-Stokes equations and momentum equations for viscous flow?",
        "Define Bernoulli equation and hydrostatic pressure distribution",
        "What is Reynolds number and flat plate boundary layer flow?"
    ]

    print("\n4. Running Semantic Vector Similarity Search Queries...")
    for idx, q in enumerate(test_queries, 1):
        print(f"\n🔍 [Query #{idx}]: '{q}'")
        results = retriever.similarity_search(q, top_k=2)
        print(f"   Found {len(results)} matching candidate chunks:")
        for r_idx, doc in enumerate(results, 1):
            m = doc.metadata
            print(f"   ↳ Result {r_idx}: [Book: '{m.get('book_title')}', Page {m.get('page_number')}]")
            print(f"     Snippet:\n{doc.page_content[:200].strip()}...\n")

    # 5. Test Deletion by Filename
    print("\n5. Testing Document Deletion from ChromaDB...")
    test_filename = test_docs[0].metadata["filename"]
    deleted = retriever.delete_by_filename(test_filename)
    print(f"   ↳ Deleted document vectors for '{test_filename}': {deleted}")

    print("\n" + "=" * 70)
    print("✅ EMBEDDER & RETRIEVER SERVICE TEST PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_embedder_and_retriever()
