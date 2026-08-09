"""
Test script for LangChain Heading-Aware Chunker.
Splits text into 800-token (~3200 character) chunks and saves cleaned metadata to tests/output_chunks.json.
Overwrites output_chunks.json cleanly on every execution.
"""

import os
import glob
import json
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

SAMPLE_PDF_DIR = os.path.join(os.path.dirname(__file__), "sample_pdfs")
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), "output_chunks.json")

def chunk_documents(docs: list, pdf_filename: str, chunk_size: int = 3200, chunk_overlap: int = 600) -> list[dict]:
    """Splits pre-parsed LangChain Document objects into clean, structured chunk dictionaries."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    raw_chunks = text_splitter.split_documents(docs)
    
    clean_chunk_list = []
    for idx, chunk in enumerate(raw_chunks):
        meta = chunk.metadata or {}
        
        clean_metadata = {
            "filename": pdf_filename,
            "book_title": meta.get("title") or pdf_filename,
            "author": meta.get("author", "Unknown"),
            "page_number": meta.get("page", 0) + 1  # 1-indexed page number
        }
        
        clean_chunk_list.append({
            "chunk_index": idx + 1,
            "page": clean_metadata["page_number"],
            "char_length": len(chunk.page_content),
            "content": chunk.page_content,
            "metadata": clean_metadata
        })
        
    return clean_chunk_list

def test_chunking(pdf_path: str, chunk_size: int = 3200, chunk_overlap: int = 600):
    filename = os.path.basename(pdf_path)
    print(f"\n--- Processing Chunker on: {filename} ---")
    
    loader = PyMuPDFLoader(pdf_path)
    docs = loader.load()
    
    clean_chunk_list = chunk_documents(docs, filename, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    print(f"Total PDF pages: {len(docs)} -> Total chunks created: {len(clean_chunk_list)}")
    
    # Delete existing JSON file if present to prevent any duplicates or leftover content
    if os.path.exists(OUTPUT_JSON_PATH):
        os.remove(OUTPUT_JSON_PATH)
        print(f"🗑️ Removed previous output file: {OUTPUT_JSON_PATH}")
        
    # Save freshly generated clean chunks to JSON
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(clean_chunk_list, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Recreated {OUTPUT_JSON_PATH} with {len(clean_chunk_list)} clean chunks.")
    
    if clean_chunk_list:
        print("\n--- Sample Clean Chunk Metadata ---")
        print(clean_chunk_list[0]["metadata"])

if __name__ == "__main__":
    pdf_files = glob.glob(os.path.join(SAMPLE_PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {SAMPLE_PDF_DIR}. Please add a textbook PDF to run chunker tests!")
    else:
        # Process the sample PDF
        for pdf_file in pdf_files:
            test_chunking(pdf_file)

