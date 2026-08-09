"""
Test Sandbox Script for Indexing State & SQLite Metadata Store (tests/test_indexing_state.py)
Tests database initialization, SHA256 hashing, document registration, status transitions, and dedup lookups.
"""

import os
import sys
import glob

# Add backend directory to sys.path
TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.indexing_state import (
    init_db,
    compute_hash,
    find_by_hash,
    register_document,
    update_status,
    update_metadata,
    get_document,
    list_all_documents,
    delete_document
)

SAMPLE_PDF_DIR = os.path.join(TESTS_DIR, "sample_pdfs")

def test_indexing_state_pipeline():
    print("=" * 65)
    print("🚀 Testing Indexing State & SQLite Metadata Store Pipeline")
    print("=" * 65)

    # 1. Initialize SQLite metadata database
    print("\n1. Initializing SQLite Metadata DB...")
    init_db()
    print("   ✅ DB initialized successfully at data/metadata.db")

    # 2. Discover sample PDF
    pdf_files = glob.glob(os.path.join(SAMPLE_PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"❌ No PDF files found in {SAMPLE_PDF_DIR}. Please place a sample PDF there!")
        return

    sample_pdf = pdf_files[0]
    filename = os.path.basename(sample_pdf)
    print(f"\n2. Computing SHA256 checksum for: {filename}")
    
    # 3. Compute SHA256 hash
    sha256 = compute_hash(sample_pdf)
    print(f"   ↳ SHA256 Hash: {sha256}")

    # 4. Check for duplicate before insertion
    existing = find_by_hash(sha256)
    if existing:
        print(f"   ℹ️ Existing duplicate record found: doc_id={existing['document_id']}, status={existing['status']}")
        # Clean up existing test record for clean test run
        delete_document(existing['document_id'])
        print(f"   🗑️ Purged previous test record for clean test execution.")

    # 5. Register document in 'pending' state
    print("\n3. Registering document in database...")
    doc_id = register_document(
        filename=filename,
        filepath=sample_pdf,
        sha256=sha256,
        book_title="Fluid Mechanics",
        author="Frank M. White"
    )
    print(f"   ✅ Registered document. UUID doc_id={doc_id}")

    # Verify document record
    doc = get_document(doc_id)
    print(f"   ↳ Initial Status: {doc['status']} | Created: {doc['created_at']}")

    # 6. Test Status Transitions
    print("\n4. Simulating Ingestion Status Transitions...")
    
    # Transition -> parsing
    update_status(doc_id, "parsing")
    print(f"   ↳ Status updated to: {get_document(doc_id)['status']}")

    # Update parsed metadata
    update_metadata(doc_id, total_pages=885)
    print(f"   ↳ Metadata updated: total_pages={get_document(doc_id)['total_pages']}")

    # Transition -> embedding
    update_status(doc_id, "embedding")
    print(f"   ↳ Status updated to: {get_document(doc_id)['status']}")

    # Transition -> done
    update_status(doc_id, "done")
    print(f"   ↳ Status updated to: {get_document(doc_id)['status']}")

    # 7. Test Deduplication Lookup
    print("\n5. Verifying Deduplication Hash Lookup...")
    dedup = find_by_hash(sha256)
    assert dedup is not None and dedup['document_id'] == doc_id
    print(f"   ✅ Deduplication check PASSED! Found document by hash: {dedup['sha256'][:16]}...")

    # 8. List all documents
    print("\n6. Listing All Documents in Store...")
    all_docs = list_all_documents()
    print(f"   Total Records in Database: {len(all_docs)}")
    for record in all_docs:
        print(f"   - [{record['status'].upper()}] {record['filename']} (Pages: {record['total_pages']}, ID: {record['document_id'][:8]}...)")

    print("\n" + "=" * 65)
    print("✅ INDEXING STATE PIPELINE TEST PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    test_indexing_state_pipeline()
