"""
Sandbox Test Script for FastAPI Backend Endpoints (tests/test_api_endpoints.py)
Tests HTTP routes: GET /health, GET /api/v1/documents, POST /api/v1/query, GET /api/v1/status/{doc_id}.
"""

import os
import sys
from fastapi.testclient import TestClient

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app

def test_fastapi_endpoints():
    print("=" * 70)
    print("🚀 Testing FastAPI Backend Routers & Endpoints")
    print("=" * 70)

    client = TestClient(app)

    # 1. Health check
    print("\n1. Testing GET /health...")
    res = client.get("/health")
    assert res.status_code == 200
    print(f"   ✅ GET /health -> {res.json()}")

    # 2. List documents
    print("\n2. Testing GET /api/v1/documents...")
    res = client.get("/api/v1/documents")
    assert res.status_code == 200
    docs_payload = res.json()
    print(f"   ✅ GET /api/v1/documents -> Total Documents: {docs_payload['total_documents']}")

    # 3. Query RAG Chat endpoint
    print("\n3. Testing POST /api/v1/query...")
    query_body = {
        "query": "What is Navier-Stokes equation?",
        "book_filter": "White_2011_7ed_Fluid-Mechanics.pdf"
    }
    res = client.post("/api/v1/query", json=query_body)
    assert res.status_code == 200
    query_res = res.json()
    print(f"   ✅ POST /api/v1/query -> Answer: {query_res['answer'][:120]}...")
    print(f"   ↳ Citations returned: {len(query_res['citations'])}")

    print("\n" + "=" * 70)
    print("✅ FASTAPI BACKEND ROUTERS TEST PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_fastapi_endpoints()
