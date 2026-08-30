#!/usr/bin/env python3
"""
scripts/reindex_domains_pinecone.py
Ingestion script for 3 Core Mechanical Engineering Domains:
  1. fluid_n_thermal -> Fluid & Thermal Sciences
  2. Solids_n_machines -> Solids & Machine Design
  3. Manufacturing_processes -> Manufacturing & Metallurgy

Optimized for Gemini Free Tier API (100 RPM limit) with batching (90 chunks/req)
and automatic 65s cooldown on 429 quota exceptions.
"""

import os
import sys
import time
import re
import hashlib
import sqlite3
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
load_dotenv(PROJECT_ROOT / "backend" / ".env")

import fitz  # PyMuPDF
from pinecone import Pinecone
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings

DOMAINS = {
    "fluid_n_thermal": "Fluid & Thermal Sciences",
    "Solids_n_machines": "Solids & Machine Design",
    "Manufacturing_processes": "Manufacturing & Metallurgy",
}

PDFS_DIR = PROJECT_ROOT / "Mech_RAG_pdfs"
DB_PATH = PROJECT_ROOT / "backend" / "data" / "metadata.db"
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "mech-rag")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not PINECONE_API_KEY or not GEMINI_API_KEY:
    raise ValueError("Missing PINECONE_API_KEY or GEMINI_API_KEY in backend/.env")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)
embedder = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GEMINI_API_KEY
)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=900,
    chunk_overlap=120,
    separators=["\n## ", "\n### ", "\n#### ", "\n\n", "\n", " ", ""]
)

def init_metadata_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            document_id TEXT PRIMARY KEY,
            filename TEXT UNIQUE NOT NULL,
            filepath TEXT,
            sha256 TEXT UNIQUE NOT NULL,
            book_title TEXT,
            domain TEXT,
            domain_name TEXT,
            status TEXT NOT NULL,
            total_pages INTEGER DEFAULT 0,
            total_chunks INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Add columns if they were missing from older migrations
    for col in ["domain TEXT", "domain_name TEXT", "total_chunks INTEGER DEFAULT 0"]:
        try:
            cursor.execute(f"ALTER TABLE documents ADD COLUMN {col}")
        except Exception:
            pass
    conn.commit()
    conn.close()

def is_already_indexed(sha256_hash: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM documents WHERE sha256 = ? AND status = 'done'", (sha256_hash,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def clean_book_title(filename: str) -> str:
    title = Path(filename).stem
    title = title.replace("_", " ").replace("-", " ").replace("  ", " ").strip()
    return title

def parse_pdf(file_path: Path) -> List[Dict[str, Any]]:
    pages_data = []
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text") or ""
            clean_text = "\n".join([line.strip() for line in text.splitlines() if line.strip()])
            if len(clean_text) >= 15:
                pages_data.append({
                    "page_number": page_num + 1,
                    "text": clean_text
                })
        doc.close()
    except Exception as e:
        print(f"    ⚠️ PyMuPDF read error for {file_path.name}: {e}")
    return pages_data

def embed_with_smart_retry(texts: List[str], max_retries: int = 10) -> List[List[float]]:
    for attempt in range(max_retries):
        try:
            return embedder.embed_documents(texts)
        except Exception as e:
            err_msg = str(e)
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg or "quota" in err_msg.lower():
                # Extract wait time if present, default to 65s cooldown
                match = re.search(r"retry in (\d+(\.\d+)?)s", err_msg)
                wait_sec = float(match.group(1)) + 3 if match else 65.0
                print(f"    ⏳ Rate limit reached. Cooling down for {wait_sec:.1f}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(wait_sec)
            else:
                wait_time = (attempt + 1) * 4
                print(f"    ⚠️ API Exception ({e}). Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(wait_time)
    raise RuntimeError(f"Failed to embed batch of {len(texts)} chunks after {max_retries} retries.")

def ingest_pdf(file_path: Path, domain_key: str, domain_name: str):
    filename = file_path.name
    book_title = clean_book_title(filename)
    
    with open(file_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    doc_id = file_hash[:16]

    if is_already_indexed(file_hash):
        print(f"  ⏭️ Already indexed: {book_title}")
        return 0

    pages = parse_pdf(file_path)
    total_pages = len(pages)
    if total_pages == 0:
        print(f"  ⚠️ Skipping empty/scanned PDF: {filename}")
        return 0

    chunks: List[Document] = []
    for p in pages:
        page_chunks = text_splitter.split_text(p["text"])
        for idx, chunk_str in enumerate(page_chunks):
            if len(chunk_str.strip()) < 20:
                continue
            chunks.append(Document(
                page_content=chunk_str,
                metadata={
                    "document_id": doc_id,
                    "filename": filename,
                    "book_title": book_title,
                    "domain": domain_key,
                    "domain_name": domain_name,
                    "page_number": p["page_number"],
                    "chunk_id": f"{doc_id}_p{p['page_number']}_c{idx}"
                }
            ))

    if not chunks:
        print(f"  ⚠️ No valid text chunks for {filename}")
        return 0

    # Batch of 80 chunks to minimize API calls while staying well under size limits
    BATCH_SIZE = 80
    total_upserted = 0
    
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        texts = [doc.page_content for doc in batch]
        embeddings = embed_with_smart_retry(texts)

        pinecone_vectors = []
        for doc, emb in zip(batch, embeddings):
            pinecone_vectors.append({
                "id": doc.metadata["chunk_id"],
                "values": emb,
                "metadata": {
                    "text": doc.page_content,
                    "document_id": doc.metadata["document_id"],
                    "filename": doc.metadata["filename"],
                    "book_title": doc.metadata["book_title"],
                    "domain": doc.metadata["domain"],
                    "domain_name": doc.metadata["domain_name"],
                    "page_number": int(doc.metadata["page_number"]),
                }
            })

        index.upsert(vectors=pinecone_vectors)
        total_upserted += len(pinecone_vectors)
        time.sleep(0.8)  # Smooth rate limiting

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (document_id, filename, filepath, sha256, book_title, domain, domain_name, status, total_pages, total_chunks)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)
        ON CONFLICT(document_id) DO UPDATE SET
            status='done', total_pages=excluded.total_pages, total_chunks=excluded.total_chunks,
            domain=excluded.domain, domain_name=excluded.domain_name, book_title=excluded.book_title
    """, (doc_id, filename, str(file_path), file_hash, book_title, domain_key, domain_name, total_pages, total_upserted))
    conn.commit()
    conn.close()

    print(f"  ✅ Indexed '{book_title}': {total_pages} pages, {total_upserted} chunks -> Pinecone")
    return total_upserted

def main():
    print("=" * 70)
    print("🚀 MechRAG Multi-Domain Ingestion & Pinecone Indexing")
    print("=" * 70)
    
    init_metadata_db()

    total_books = 0
    total_vectors = 0

    print("\n📚 Indexing PDFs across 3 Mechanical Domains...")
    for domain_key, domain_name in DOMAINS.items():
        domain_folder = PDFS_DIR / domain_key
        if not domain_folder.exists():
            continue

        pdfs = sorted(list(domain_folder.rglob("*.pdf")) + list(domain_folder.rglob("*.PDF")))
        print(f"\n📂 Domain: [{domain_name}] ({len(pdfs)} PDFs)")
        
        for idx, pdf_path in enumerate(pdfs, 1):
            rel_path = pdf_path.relative_to(PDFS_DIR)
            print(f" [{idx}/{len(pdfs)}] Processing: {rel_path}...")
            try:
                upserted = ingest_pdf(pdf_path, domain_key, domain_name)
                total_vectors += upserted
                total_books += 1
            except Exception as e:
                print(f"  ❌ Error processing {pdf_path.name}: {e}")

    print("\n" + "=" * 70)
    print("🎉 Ingestion Run Complete!")
    print(f"Total Textbooks & Slide Decks Processed: {total_books}")
    print(f"New Vectors Upserted: {total_vectors}")
    stats = index.describe_index_stats()
    print("Pinecone Current Stats:", stats)
    print("=" * 70)

if __name__ == "__main__":
    main()
