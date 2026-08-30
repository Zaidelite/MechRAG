import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from app.services.indexing_state import list_all_documents, get_document, delete_document as db_delete_document
from app.routers.upload import rag_engine

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])

DOMAINS_METADATA = [
    {
        "id": "fluid_n_thermal",
        "name": "Fluid & Thermal Sciences",
        "description": "Thermodynamics, Heat Transfer, Fluid Mechanics, IC Engines, and Aerodynamics",
        "icon": "Waves",
    },
    {
        "id": "Solids_n_machines",
        "name": "Solids & Machine Design",
        "description": "Dynamics, Statics & Strength of Materials, Material Science, Machine Design (Shigley's)",
        "icon": "Cpu",
    },
    {
        "id": "Manufacturing_processes",
        "name": "Manufacturing & Metallurgy",
        "description": "Welding Metallurgy & Processes, Casting, Non-Traditional Machining (NTM), MTM",
        "icon": "Factory",
    },
]

@router.get("/domains")
async def list_domains():
    """Returns the 3 Core Mechanical Engineering domains with textbook counts."""
    docs = list_all_documents()
    domain_counts = {}
    for doc in docs:
        d_id = doc.get("domain")
        if d_id:
            domain_counts[d_id] = domain_counts.get(d_id, 0) + 1

    result = []
    for d in DOMAINS_METADATA:
        result.append({
            **d,
            "document_count": domain_counts.get(d["id"], 0)
        })
    return {"domains": result, "total_documents": len(docs)}

@router.get("")
@router.get("/")
async def list_documents():
    """Returns a list of all uploaded/indexed textbooks and metadata status from SQLite metadata DB."""
    records = list_all_documents()
    return {
        "total_documents": len(records),
        "documents": records
    }

@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """
    Deletes an indexed document:
    1. Purges vector embeddings from ChromaDB
    2. Deletes metadata record from SQLite metadata.db
    3. Removes raw PDF file from disk
    """
    doc_record = get_document(document_id)
    if not doc_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )

    filename = doc_record["filename"]
    filepath = doc_record["filepath"]

    # 1. Purge vectors from ChromaDB
    rag_engine.retriever.delete_by_filename(filename)

    # 2. Delete record from SQLite metadata DB
    db_delete_document(document_id)

    # 3. Delete raw PDF from disk
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"⚠️ Error removing file '{filepath}': {e}")

    return {
        "document_id": document_id,
        "filename": filename,
        "status": "deleted",
        "message": f"Successfully deleted document '{filename}' and purged vector store."
    }

