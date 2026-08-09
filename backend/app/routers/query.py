from fastapi import APIRouter, HTTPException, status
from app.schemas.rag_schemas import QueryRequest, QueryResponse
from app.routers.upload import rag_engine

router = APIRouter(prefix="/api/v1/query", tags=["Query"])

@router.post("", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    RAG Search & Chat Endpoint.
    1. Runs hybrid BM25 + dense vector similarity search
    2. Re-ranks candidates via Reciprocal Rank Fusion (RRF)
    3. Invokes Gemini LLM with LaTeX math preservation rules
    4. Returns answer + traceable source citations
    """
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty."
        )

    filters = {}
    if request.book_filter:
        filters["book_title"] = request.book_filter

    response = rag_engine.query(
        query_text=request.query,
        filters=filters if filters else None
    )

    return response

