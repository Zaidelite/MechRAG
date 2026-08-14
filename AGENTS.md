# AGENTS.md - Mechanical Engineering RAG Platform (`MechRAG`)

## Project overview
Build a Retrieval-Augmented Generation (RAG) platform tailored for Mechanical Engineering college textbooks, lecture notes, and study materials. The platform extracts and renders complex LaTeX math formulas ($\sigma = F/A$, Navier-Stokes), provides traceable citations (Book Title, Chapter, Page X), and operates using local vector embeddings (HuggingFace) + Free Google Gemini API.

## Architecture & Design Improvements
Benchmarked against production-grade RAG reference architectures (Cognita). Key architectural standards enforced:
1. **Async/background ingestion**: `upload.py` returns HTTP `202 Accepted` immediately and delegates processing to `BackgroundTasks`.
2. **SHA256 Hash Deduplication**: `indexing_state.py` computes SHA256 per file to prevent duplicate vector indexing on re-uploads.
3. **Metadata Store (`data/metadata.db`)**: SQLite store managing document records, status transitions (`pending` → `parsing` → `embedding` → `done`), and total page counts.
4. **Ingestion Status Polling (`status.py`)**: Real-time status endpoint (`GET /api/v1/status/{document_id}`) allowing frontend progress UI updates.
5. **Decoupled Business Services**: Pluggable `BaseParser` and `BaseEmbedder` interfaces.

---

## Folder structure
```text
MechRAG/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app instance, CORS middleware, lifespan startup
│   │   ├── config.py                   # Pydantic environment configuration
│   │   ├── routers/                    # API Endpoints
│   │   │   ├── upload.py               # Async PDF upload router (202 Accepted + BackgroundTasks)
│   │   │   ├── status.py               # Ingestion status polling router (/status/{id})
│   │   │   ├── query.py                # RAG search & chat query router
│   │   │   └── documents.py            # Document library management & purging router
│   │   ├── services/                   # Decoupled Business Logic Services
│   │   │   ├── parser.py               # PyMuPDF fast LaTeX character & equation parser
│   │   │   ├── chunker.py              # Heading-aware 800-token chunker
│   │   │   ├── embedder.py             # Local SentenceTransformers embedder (BAAI/bge-small-en-v1.5)
│   │   │   ├── retriever.py            # ChromaDB vector similarity retriever
│   │   │   ├── reranker.py             # Hybrid BM25 + Reciprocal Rank Fusion (RRF) reranker
│   │   │   ├── prompt_builder.py       # Engineering system prompt & LaTeX context builder
│   │   │   ├── llm.py                  # Free Google Gemini API client (gemini-2.5-flash)
│   │   │   ├── citation.py             # Citation formatter (Book, Chapter, Page X, Snippet)
│   │   │   ├── indexing_state.py       # SQLite metadata.db store, SHA256 dedup & status read/write
│   │   │   └── rag_engine.py           # High-level RAG pipeline orchestrator
│   │   └── schemas/
│   │       └── rag_schemas.py          # Pydantic request/response models
│   ├── data/
│   │   ├── uploads/                    # Uploaded PDF textbooks
│   │   ├── chroma_db/                  # Persistent ChromaDB vector database
│   │   └── metadata.db                 # SQLite metadata store (documents, sha256, status)
│   ├── requirements.txt                # Python dependencies
│   ├── Dockerfile                      # Backend container configuration
│   └── .env.example                    # Environment settings template
├── frontend/                           # Next.js 14/15 React Web Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root HTML & KaTeX CSS layout
│   │   │   ├── page.tsx                # Main chat & dashboard page
│   │   │   └── globals.css             # Tailwind CSS & dark theme
│   │   ├── components/                 # MathMarkdown, CitationDrawer, UploadModal, Sidebar
│   │   ├── services/                   # Frontend API client (api.ts)
│   │   └── types/                      # TypeScript definitions (index.ts)
│   ├── package.json                    # Node dependencies (Next.js, KaTeX, Tailwind)
│   ├── Dockerfile                      # Frontend container configuration
│   └── next.config.mjs                 # Next.js API rewrites configuration
├── tests/                              # Sandbox for prototyping & testing code before backend integration
├── docker-compose.yml                  # Multi-container orchestration (Backend 8000, Frontend 3001)
├── .gitignore                          # Git ignore rules
└── README.md                           # Public repository documentation
```

## Tech stack
- **Backend API**: Python 3.11+ / FastAPI
- **RAG Framework**: LangChain (`langchain`, `langchain-community`, `langchain-core`, `langchain-google-genai`, `langchain-chroma`, `langchain-huggingface`)
- **PDF Extraction**: PyMuPDF (`fitz`) / `PyMuPDFLoader`
- **Vector Database**: ChromaDB via `langchain-chroma` (local persistent store)
- **Metadata Store**: SQLite (`sqlite3`) tracking document hashes and ingestion status
- **Embeddings**: `HuggingFaceEmbeddings` (`BAAI/bge-small-en-v1.5`) — 100% local, zero API cost
- **LLM Inference**: `ChatGoogleGenerativeAI` (`gemini-2.5-flash`)
- **Frontend Web UI**: Next.js 14/15 + React 18 + Tailwind CSS (Port `3001`)
- **Math Rendering**: KaTeX (`remark-math`, `rehype-katex`) for client-side zero-flicker LaTeX math
- **Package Managers**: `uv` (Python environment `mech_rag_backend/`) & `npm` (Node)
- **Containerization**: `docker-compose.yml`

## Coding conventions
- **Explicit Instruction Required**: Do NOT implement or change code until the user explicitly instructs/asks to do so.
- **LangChain First Architecture**: Build all RAG pipelines, loaders, text splitters, vectorstores, and chains using LangChain standard abstractions (`Document`, `BaseRetriever`, `RunnableSequence` / LCEL).
- **NO GOD FILES**: All backend business logic MUST remain strictly decoupled inside single-responsibility modules in `backend/app/services/`.
- **LaTeX Math Rules**: Preserve raw LaTeX formatting (`$...$`, `$$...$$`) during text extraction and force LLM responses to use valid LaTeX syntax for equations.
- **Traceable Citations**: Every RAG answer payload must include structured citation metadata (Book Title, Chapter, Page Number, Text Snippet).
- **Non-Blocking Ingestion**: `upload.py` MUST NOT run parsing/chunking/embedding synchronously on the request thread. Enqueue via `BackgroundTasks` and return `202 Accepted` with a `document_id` immediately.
- **Idempotent Ingestion**: Compute SHA256 checksum and check `metadata.db` before re-embedding files.

---

## Progress & Completed Milestone Tasks
- [x] **Task 0: SQLite Metadata Store (`indexing_state.py` & `metadata.db`)** - Hash deduplication and state transitions (`pending` → `parsing` → `embedding` → `done`).
- [x] **Task 1: PDF Parser & Chunker (`parser.py` & `chunker.py`)** - PyMuPDF fast LaTeX character normalizer and 800-token `RecursiveCharacterTextSplitter`.
- [x] **Task 2: Embeddings & Vector Storage (`embedder.py` & `retriever.py`)** - Local `HuggingFaceEmbeddings("BAAI/bge-small-en-v1.5")` & persistent ChromaDB vector store.
- [x] **Task 3: Reranker, LLM & RAG Orchestrator (`reranker.py`, `prompt_builder.py`, `llm.py`, `rag_engine.py`)** - Hybrid BM25 + RRF reranking, Google Gemini 2.5 Flash, and traceable citation formatter.
- [x] **Task 4: Production FastAPI Routers (`upload.py`, `status.py`, `query.py`, `documents.py`)** - Non-blocking async upload, status polling endpoint, RAG query endpoint, and document library purge endpoint.
- [x] **Task 5: Interactive Next.js Frontend Web UI (`frontend/`)** - KaTeX zero-flicker LaTeX renderer, slide-over citation drawer, upload status polling modal, and dark glassmorphic dashboard.

---

## Future / Next Phase Tasks
- [x] **Push project repository to GitHub.**
- [ ] **Enhance frontend design & visual aesthetics** (animations, themes, micro-interactions).
- [ ] **Deploy platform to web hosting / cloud infrastructure.**

