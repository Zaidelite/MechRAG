# Test Sandbox (`tests/`)

This directory is used to prototype, experiment, and test individual RAG components (LangChain PDF parser, chunker, embeddings, retriever, reranker, LLM engine) before integrating them into the production backend services (`backend/app/services/`).

## Folder Structure
```text
tests/
├── sample_pdfs/                # Place your sample textbook / lecture note PDFs here
├── test_parser.py              # Fast PyMuPDF PDF text & LaTeX formula preserving module
├── test_chunker.py             # LangChain RecursiveCharacterTextSplitter module
├── test_indexing_state.py      # SQLite metadata store & SHA256 dedup test script
├── test_embedder_retriever.py  # Local BAAI/bge-small-en-v1.5 embeddings & ChromaDB vector search test
├── test_rag_engine.py          # Master sandbox orchestrator (Parser -> Chunker -> output_chunks.json)
└── README.md
```

## How to Run Tests

1. Place your textbook PDF in `tests/sample_pdfs/`.
2. Run SQLite metadata store & dedup pipeline test:
   ```bash
   ../mech_rag_backend/bin/python test_indexing_state.py
   ```
3. Run Local Embedder & ChromaDB Vector Search test:
   ```bash
   ../mech_rag_backend/bin/python test_embedder_retriever.py
   ```
4. Run the **Master RAG Engine Sandbox Test** (connects parser & chunker):
   ```bash
   ../mech_rag_backend/bin/python test_rag_engine.py
   ```


3. Or run standalone module tests:
   ```bash
   ../mech_rag_backend/bin/python test_parser.py
   ../mech_rag_backend/bin/python test_chunker.py
   ```


