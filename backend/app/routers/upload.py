import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, status
from app.schemas.rag_schemas import DocumentStatusResponse, IngestionStatus
from app.services.indexing_state import compute_hash, find_by_hash, register_document, get_document
from app.services.rag_engine import RAGEngine

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/v1/upload", tags=["Upload"])

# Shared RAG Engine Instance
rag_engine = RAGEngine()

def process_pdf_background(pdf_path: str):
    """Background worker task for parsing, chunking, and embedding uploaded PDFs."""
    try:
        rag_engine.ingest_pdf(pdf_path, force_reindex=False)
    except Exception as e:
        print(f"❌ Background ingestion error for '{pdf_path}': {e}")

@router.post("", response_model=DocumentStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: Optional[str] = Form("General"),
    book_title: Optional[str] = Form(None)
):
    """
    Asynchronous PDF Textbook Upload Endpoint.
    1. Saves PDF file to data/uploads/
    2. Computes SHA256 checksum for instant deduplication check
    3. Enqueues background parsing & vector indexing task
    4. Returns 202 Accepted with document_id UUID for frontend status polling
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF document files (.pdf) are supported."
        )

    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Compute SHA256 checksum
    sha256 = compute_hash(file_path)
    existing = find_by_hash(sha256)

    if existing and existing.get("status") == "done":
        return DocumentStatusResponse(
            document_id=existing["document_id"],
            filename=existing["filename"],
            status=IngestionStatus.DONE,
            total_pages=existing.get("total_pages"),
            error_message=None,
            is_duplicate=True
        )

    # Register document in pending state
    if existing:
        document_id = existing["document_id"]
    else:
        document_id = register_document(
            filename=file.filename,
            filepath=str(file_path),
            sha256=sha256,
            book_title=book_title or file.filename
        )

    # Enqueue background ingestion worker
    background_tasks.add_task(process_pdf_background, str(file_path))

    return DocumentStatusResponse(
        document_id=document_id,
        filename=file.filename,
        status=IngestionStatus.PENDING,
        total_pages=None,
        error_message=None,
        is_duplicate=False
    )

