"""
Indexing State Service (SQLite Metadata Store)
Manages document registration, SHA256 file deduplication, and ingestion status tracking.
"""

import sqlite3
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Path to persistent SQLite database
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "metadata.db"

@contextmanager
def get_connection():
    """Context manager for SQLite connections with dict-like row access and auto-commit."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    """Initializes SQLite metadata.db database and creates the 'documents' table."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                document_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                filepath TEXT,
                sha256 TEXT NOT NULL UNIQUE,
                book_title TEXT,
                domain TEXT,
                domain_name TEXT,
                author TEXT,
                total_pages INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

def compute_hash(filepath: Path | str) -> str:
    """Computes SHA256 checksum of a file in 8KB chunks for memory efficiency."""
    filepath = Path(filepath)
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def find_by_hash(sha256: str) -> Optional[Dict[str, Any]]:
    """Lookup existing document record by SHA256 hash for deduplication."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE sha256 = ?", (sha256,)
        ).fetchone()
        return dict(row) if row else None

def register_document(filename: str, filepath: str, sha256: str, book_title: Optional[str] = None, author: Optional[str] = None) -> str:
    """Registers a new uploaded PDF document in 'pending' state and returns its generated UUID."""
    document_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO documents
               (document_id, filename, filepath, sha256, book_title, author, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (document_id, filename, filepath, sha256, book_title, author, now, now)
        )
    return document_id

def update_status(document_id: str, status: str, error_message: Optional[str] = None):
    """Updates ingestion status ('pending' -> 'parsing' -> 'embedding' -> 'done' | 'failed')."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """UPDATE documents
               SET status = ?, error_message = ?, updated_at = ?
               WHERE document_id = ?""",
            (status, error_message, now, document_id)
        )

def update_metadata(document_id: str, book_title: Optional[str] = None, author: Optional[str] = None, total_pages: Optional[int] = None):
    """Updates parsed document metadata (book_title, author, total_pages)."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """UPDATE documents
               SET book_title = COALESCE(?, book_title),
                   author = COALESCE(?, author),
                   total_pages = COALESCE(?, total_pages),
                   updated_at = ?
               WHERE document_id = ?""",
            (book_title, author, total_pages, now, document_id)
        )

def get_document(document_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves document record dictionary by document_id UUID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE document_id = ?", (document_id,)
        ).fetchone()
        return dict(row) if row else None

def list_all_documents() -> List[Dict[str, Any]]:
    """Returns a list of all document records in the database."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM documents ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]

def delete_document(document_id: str) -> bool:
    """Deletes a document record from metadata.db by document_id UUID."""
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM documents WHERE document_id = ?", (document_id,)
        )
        return cursor.rowcount > 0
