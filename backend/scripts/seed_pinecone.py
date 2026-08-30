import os
import sys
from pathlib import Path

# Add backend directory to Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.rag_engine import RAGEngine

def seed_all_textbooks():
    """Batch indexes all PDF textbooks into Pinecone Cloud Vector Database."""
    print("=" * 60)
    print("🚀 Starting Batch Ingestion into Pinecone Cloud Database...")
    print("=" * 60)
    
    rag_engine = RAGEngine()
    
    pdf_dirs = [
        BASE_DIR / "Mech_RAG_pdfs",
        BASE_DIR.parent / "Mech_RAG_pdfs",
        Path("/app/Mech_RAG_pdfs"),
        BASE_DIR / "data" / "uploads",
        Path("/app/data/uploads")
    ]
    
    found_pdfs = []
    for d in pdf_dirs:
        if d.exists():
            for p in d.rglob("*.pdf"):
                if p.is_file():
                    found_pdfs.append(p)
    
    print(f"📚 Found {len(found_pdfs)} PDF files to index.")
    
    success_count = 0
    for idx, pdf_path in enumerate(found_pdfs, 1):
        print(f"\n[{idx}/{len(found_pdfs)}] Indexing: {pdf_path.name} ({pdf_path.stat().st_size / (1024*1024):.1f} MB)...")
        try:
            result = rag_engine.ingest_pdf(str(pdf_path), force_reindex=False)
            status = result.get("status", "unknown")
            is_dup = result.get("is_duplicate", False)
            if is_dup:
                print(f"  ⚡ Already indexed (SHA256 duplicate). Skipped.")
            else:
                print(f"  ✅ Status: {status} (Chunks: {result.get('chunks_indexed', 0)})")
            success_count += 1
        except Exception as e:
            print(f"  ❌ Error indexing {pdf_path.name}: {e}")
            
    print("\n" + "=" * 60)
    print(f"🎉 Batch Ingestion Complete! Successfully processed {success_count}/{len(found_pdfs)} PDFs.")
    print("=" * 60)

if __name__ == "__main__":
    seed_all_textbooks()
