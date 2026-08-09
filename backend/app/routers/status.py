"""
Status Router (/api/v1/status)
Provides ingestion status polling endpoints for uploaded PDF documents.
"""

from fastapi import APIRouter, HTTPException, status
from app.schemas.rag_schemas import DocumentStatusResponse, IngestionStatus
from app.services.indexing_state import get_document

router = APIRouter(prefix="/api/v1/status", tags=["Status"])

@router.get("/{document_id}", response_model=DocumentStatusResponse)
async def get_ingestion_status(document_id: str):
    """
    Returns the real-time ingestion status ('pending' -> 'parsing' -> 'embedding' -> 'done' | 'failed')
    for an uploaded document UUID.
    """
    doc_record = get_document(document_id)
    if not doc_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found in metadata store."
        )

    return DocumentStatusResponse(
        document_id=doc_record["document_id"],
        filename=doc_record["filename"],
        status=IngestionStatus(doc_record["status"]),
        total_pages=doc_record.get("total_pages"),
        error_message=doc_record.get("error_message"),
        is_duplicate=False
    )
