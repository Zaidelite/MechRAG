from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class IngestionStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    EMBEDDING = "embedding"
    DONE = "done"
    FAILED = "failed"

class ChatMessageSchema(BaseModel):
    role: str = Field(..., description="Role of the speaker: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")

class QueryRequest(BaseModel):
    query: str = Field(..., description="Mechanical engineering search query or question")
    history: Optional[List[ChatMessageSchema]] = Field(default=None, description="Previous conversation history turns for multi-turn chat memory")
    subject_filter: Optional[str] = Field(None, description="Filter search by subject (e.g. Thermodynamics)")
    book_filter: Optional[str] = Field(None, description="Filter search by specific book title")
    model_name: Optional[str] = Field(None, description="Dynamic LLM model choice (e.g. gemini-2.5-flash)")

class CitationSchema(BaseModel):
    book_title: str
    chapter: str
    page_number: int
    text_snippet: str
    diagram_url: Optional[str] = None
    similarity_score: float

class QueryResponse(BaseModel):
    query: str
    answer: str
    citations: List[CitationSchema]

class DocumentRecord(BaseModel):
    document_id: str = Field(..., description="UUID generated at upload time")
    filename: str
    filepath: str
    sha256: str
    book_title: Optional[str] = None
    author: Optional[str] = None
    total_pages: Optional[int] = None
    status: IngestionStatus = IngestionStatus.PENDING
    error_message: Optional[str] = None
    created_at: str
    updated_at: str

class DocumentStatusResponse(BaseModel):
    document_id: str
    filename: str
    status: IngestionStatus
    total_pages: Optional[int] = None
    error_message: Optional[str] = None
    is_duplicate: bool = False

class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    book_title: str
    subject: str
    page_count: int
    chunk_count: int
    upload_timestamp: str

class UploadResponse(BaseModel):
    message: str
    document_info: DocumentInfo

