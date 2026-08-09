import os
import sys
import glob
import json
import time

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.parser import PDFParserService
from app.services.chunker import TextChunkerService
from test_parser import count_latex_formulas
from app.services.indexing_state import (
    init_db,
    compute_hash,
    find_by_hash,
    register_document,
    update_status,
    update_metadata,
    get_document
)

SAMPLE_PDF_DIR = os.path.join(TESTS_DIR, "sample_pdfs")
OUTPUT_JSON_PATH = os.path.join(TESTS_DIR, "output_chunks.json")

def run_rag_engine_test(max_pages: int = None, force_reindex: bool = False):
    print("=" * 70)
    print("🚀 Running Master RAG Engine Sandbox Test (Metadata DB -> Parser -> Chunker)")
    print("=" * 70)

    # 1. Initialize SQLite metadata store
    init_db()

    # 2. Discover sample PDFs
    pdf_files = glob.glob(os.path.join(SAMPLE_PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"❌ No PDF files found in {SAMPLE_PDF_DIR}. Please place a sample PDF there!")
        return

    all_chunks = []
    total_pages_parsed = 0
    start_time = time.time()

    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        
        # Step 0: Compute SHA256 hash and check metadata DB for duplicates
        sha256 = compute_hash(pdf_path)
        print(f"\n🔑 [STAGE 0: DEDUPLICATION] Computing SHA256 for: {filename}")
        print(f"   ↳ SHA256: {sha256}")

        existing_record = find_by_hash(sha256)
        if existing_record and existing_record.get("status") == "done" and not force_reindex:
            print("\n" + "✨" * 35)
            print(f"ℹ️  [DEDUPLICATION MATCH] Document '{filename}' already indexed!")
            print(f"   ↳ UUID doc_id: {existing_record['document_id']}")
            print(f"   ↳ Status: {existing_record['status'].upper()} | Total Pages: {existing_record['total_pages']}")
            print(f"   ↳ Skipped re-parsing and re-chunking. Zero redundant work done.")
            print("✨" * 35 + "\n")
            continue

        # Register or update document in metadata.db
        if existing_record:
            doc_id = existing_record["document_id"]
            update_status(doc_id, "pending")
        else:
            doc_id = register_document(
                filename=filename,
                filepath=pdf_path,
                sha256=sha256,
                book_title=filename,
                author="Unknown"
            )
        print(f"   ↳ Registered document in DB: UUID doc_id={doc_id}")

        # Step 1: Parse PDF into LangChain Document objects via production PDFParserService
        update_status(doc_id, "parsing")
        print(f"\n📄 [STAGE 1: LATEX PARSING] Processing: {filename}")
        parser_service = PDFParserService()
        documents = parser_service.parse_pdf(pdf_path, max_pages=max_pages)
        page_count = len(documents)
        total_pages_parsed += page_count
        
        # Update metadata.db with parsed page count and book title
        if documents:
            first_doc_meta = documents[0].metadata
            update_metadata(
                doc_id,
                book_title=first_doc_meta.get("book_title") or filename,
                author=first_doc_meta.get("author") or "Unknown",
                total_pages=page_count
            )

        if not documents:
            update_status(doc_id, "failed", error_message="No page content extracted")
            print(f"   ⚠️ Warning: No page content extracted from {filename}")
            continue

        # Step 2: Pass parsed documents into Chunker via production TextChunkerService
        update_status(doc_id, "embedding")  # In full RAG, chunking + embedding
        print(f"\n✂️  [STAGE 2: CHUNKING] Splitting into 800-token chunks...")
        chunker_service = TextChunkerService()
        chunks = chunker_service.chunk_documents_to_dicts(documents, filename)
        print(f"   ↳ Created {len(chunks)} chunks from {page_count} sections.")

        all_chunks.extend(chunks)

        # Mark document as done in SQLite metadata DB
        update_status(doc_id, "done")
        print(f"   ✅ Document state set to 'DONE' in data/metadata.db")

    # Write output_chunks.json if new chunks were generated
    if all_chunks:
        if os.path.exists(OUTPUT_JSON_PATH):
            os.remove(OUTPUT_JSON_PATH)
        with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(all_chunks, f, indent=2, ensure_ascii=False)

    # 4. Calculate total LaTeX math formula metrics
    combined_content = "\n".join([chunk["content"] for chunk in all_chunks]) if all_chunks else ""
    formula_stats = count_latex_formulas(combined_content)

    elapsed_time = time.time() - start_time
    print("\n" + "=" * 70)
    print("✅ RAG ENGINE SANDBOX PIPELINE COMPLETE")
    print(f"⏱️  Total Processing Time: {elapsed_time:.2f} seconds")
    print(f"📚 Total PDF Sections Parsed: {total_pages_parsed}")
    print(f"📦 Total Chunks Generated: {len(all_chunks)}")
    print(f"📐 LaTeX Formulas Preserved: {formula_stats['total_latex']} (Inline: {formula_stats['inline_latex']}, Block: {formula_stats['block_latex']})")
    if all_chunks:
        print(f"💾 Saved Unified Output to: {OUTPUT_JSON_PATH}")
    print("=" * 70)

    if all_chunks:
        print("\n--- Sample Chunk Metadata & Snippet ---")
        sample = all_chunks[0]
        print(f"Chunk #{sample['chunk_index']} | Section/Page {sample['page']} | Length: {sample['char_length']} chars")
        print(f"Metadata: {sample['metadata']}")
        print(f"Snippet:\n{sample['content'][:250]}...\n")

if __name__ == "__main__":
    # Runs for the ENTIRE textbook (all 885 pages)
    run_rag_engine_test(max_pages=None, force_reindex=False)


