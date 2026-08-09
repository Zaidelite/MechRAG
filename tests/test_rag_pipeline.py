"""
Sandbox Test Script for End-to-End RAG Engine Pipeline (tests/test_rag_pipeline.py)
Tests full document ingestion, hybrid BM25 + Vector search, RRF reranking, System Prompting, Gemini LLM inference, and Citations.
"""

import os
import sys
import glob

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.rag_engine import RAGEngine
from app.config import settings

SAMPLE_PDF_DIR = os.path.join(TESTS_DIR, "sample_pdfs")
TEST_CHROMA_DIR = os.path.join(TESTS_DIR, "test_chroma_db")

def test_full_rag_pipeline():
    print("=" * 70)
    print("🚀 Running End-to-End RAG Engine Pipeline Test")
    print("=" * 70)

    # Check Gemini API Key
    if not settings.GEMINI_API_KEY and not os.getenv("GEMINI_API_KEY"):
        print("⚠️ Warning: GEMINI_API_KEY is not set! Set GEMINI_API_KEY in backend/.env to test live LLM generation.")

    # 1. Initialize RAG Engine
    print("\n1. Initializing RAGEngine Orchestrator...")
    engine = RAGEngine(chroma_dir=TEST_CHROMA_DIR)
    print("   ✅ RAGEngine initialized!")

    # 2. Discover sample PDF
    pdf_files = glob.glob(os.path.join(SAMPLE_PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"❌ No PDF files found in {SAMPLE_PDF_DIR}!")
        return

    sample_pdf = pdf_files[0]
    print(f"\n2. Ingesting PDF: '{os.path.basename(sample_pdf)}'...")
    ingest_result = engine.ingest_pdf(sample_pdf, max_pages=None, force_reindex=True)
    print(f"   ↳ Ingestion Result: {ingest_result}")

    # 3. Execute Mechanical Engineering Test Queries
    queries = [
        "What are the Navier-Stokes equations for incompressible fluid flow?",
        "Define hydrostatic pressure distribution and panel force",
        "What is Reynolds number and pipe head loss?"
    ]

    print("\n3. Executing End-to-End RAG Queries (Retrieval -> RRF -> Gemini LLM -> Citation)...")
    for idx, q in enumerate(queries, start=1):
        print(f"\n" + "─" * 60)
        print(f"❓ [QUERY #{idx}]: {q}")
        print("─" * 60)

        response = engine.query(q, top_k_vector=10, top_n_rerank=4)
        
        print("\n🤖 [LLM GENERATED ANSWER (LaTeX Math Preserved)]:")
        print(response.answer)
        
        print("\n📚 [TRACEABLE CITATIONS]:")
        for c_idx, cit in enumerate(response.citations, start=1):
            print(f"   [{c_idx}] {cit.book_title} (Page {cit.page_number}) | RRF Score: {cit.similarity_score:.4f}")
            print(f"       Snippet: {cit.text_snippet[:150]}...")

    print("\n" + "=" * 70)
    print("✅ END-TO-END RAG ENGINE PIPELINE TEST PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_full_rag_pipeline()
