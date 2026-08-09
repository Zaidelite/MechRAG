from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import upload, status, query, documents
from app.services.indexing_state import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite metadata.db database and tables on startup
    init_db()
    yield

app = FastAPI(
    title="Mechanical Engineering RAG Platform API",
    description="Backend API for indexing and querying Mech textbooks with formula & diagram support.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Router modules
app.include_router(upload.router)
app.include_router(status.router)
app.include_router(query.router)
app.include_router(documents.router)

@app.get("/")
async def root():
    return {"message": "Mech RAG Platform API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
