import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BASE_DIR))

from app.services.rag_engine import RAGEngine

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "Mech_RAG_pdfs"
    target_path = Path(target_dir)

    if not target_path.exists():
        target_dir = "tests/sample_pdfs"
        target_path = Path(target_dir)

    # Recursive search for all PDF files in nested folders
    pdf_files = sorted(list(target_path.rglob("*.pdf")))
    
    if not pdf_files:
        print(f"⚠️ No PDF files found in directory: {target_dir}")
        return

    print(f"📚 Found {len(pdf_files)} PDF document(s) across nested folders in '{target_dir}':")
    for p in pdf_files[:10]:
        print(f" - {p.relative_to(target_path)}")
    if len(pdf_files) > 10:
        print(f" ... and {len(pdf_files) - 10} more PDF files.")

    engine = RAGEngine()

    success_count = 0
    skipped_count = 0
    failed_count = 0

    for idx, pdf_path in enumerate(pdf_files, start=1):
        rel_path = pdf_path.relative_to(target_path)
        filename = pdf_path.name
        print(f"\n[Progress {idx}/{len(pdf_files)}] 🚀 Ingesting: {rel_path}...")
        try:
            res = engine.ingest_pdf(str(pdf_path), force_reindex=False)
            status = res.get("status")
            if res.get("is_duplicate"):
                print(f"  ⏭️ Already indexed (SHA256 duplicate match). Skipped.")
                skipped_count += 1
            elif status == "done":
                print(f"  ✅ Complete! Pages: {res.get('total_pages')} | Chunks: {res.get('chunks_indexed')}")
                success_count += 1
            else:
                print(f"  ⚠️ Status: {status} | Error: {res.get('error')}")
                failed_count += 1
        except Exception as e:
            print(f"  ❌ Exception during ingestion: {e}")
            failed_count += 1

    print("\n" + "=" * 50)
    print(f"🎉 INGESTION COMPLETE! Summary:")
    print(f"   - Newly Indexed: {success_count}")
    print(f"   - Already Indexed: {skipped_count}")
    print(f"   - Errors/Failed: {failed_count}")
    print(f"   - Total Processed: {len(pdf_files)}")
    print("=" * 50)

if __name__ == "__main__":
    main()
