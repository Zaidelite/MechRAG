import os
import re
import fitz  # PyMuPDF
from abc import ABC, abstractmethod
from typing import List, Optional
from langchain_core.documents import Document

# Math font glyph mapping for PDF extraction
MATH_GLYPH_MAP = {
    "\x02": " = ",
    "\x03": " + ",
    "\x04": " - ",
    "\x05": " \\cdot ",
    "\x06": " = ",
    "\x07": " \\partial ",
    "\x0b": " \\beta ",
    "\x0c": " \\gamma ",
    "\x0d": " \\Delta ",
    "\x0e": " \\epsilon ",
    "∂": " \\partial ",
    "∇": " \\nabla ",
    "∫": " \\int ",
    "∑": " \\sum ",
    "∏": " \\prod ",
    "α": " \\alpha ",
    "β": " \\beta ",
    "γ": " \\gamma ",
    "δ": " \\delta ",
    "ε": " \\epsilon ",
    "θ": " \\theta ",
    "λ": " \\lambda ",
    "μ": " \\mu ",
    "π": " \\pi ",
    "ρ": " \\rho ",
    "σ": " \\sigma ",
    "τ": " \\tau ",
    "φ": " \\phi ",
    "ω": " \\omega ",
    "Ω": " \\Omega ",
    "∞": " \\infty ",
    "≈": " \\approx ",
    "≠": " \\neq ",
    "≤": " \\leq ",
    "≥": " \\geq ",
    "±": " \\pm ",
    "×": " \\times ",
    "÷": " \\div "
}

class BaseParser(ABC):
    """Abstract base parser interface for pluggable document loaders."""
    @abstractmethod
    def parse_pdf(self, pdf_path: str, max_pages: Optional[int] = None) -> List[Document]:
        pass

class PDFParserService(BaseParser):
    """
    Production-grade Fast PyMuPDF PDF Parser.
    Extracts text and normalizes mathematical formulas into LaTeX syntax ($...$ and $$...$$).
    """
    def __init__(self):
        pass

    def clean_and_preserve_latex(self, text: str) -> str:
        """Sanitizes control codes and formats mathematical expressions into valid LaTeX syntax."""
        for char, latex in MATH_GLYPH_MAP.items():
            text = text.replace(char, latex)
            
        lines = text.split("\n")
        processed_lines = []
        
        for line in lines:
            stripped = line.strip()
            if re.search(r'(=|\\partial|\\nabla|\\int|\\sum|\\rho|\\mu|\\sigma)\s*', stripped) and len(stripped) < 120 and not stripped.endswith("."):
                if not stripped.startswith("$"):
                    processed_lines.append(f"\n$$\n{stripped}\n$$\n")
                else:
                    processed_lines.append(line)
            else:
                line_cleaned = re.sub(r'(\b[a-zA-Z]\b\s*=\s*[^,\n\.]+)', r'$\1$', line)
                processed_lines.append(line_cleaned)
                
        return "\n".join(processed_lines)

    def parse_pdf(self, pdf_path: str, max_pages: Optional[int] = None) -> List[Document]:
        """Parses PDF pages into standard LangChain Document objects with LaTeX math formatting."""
        filename = os.path.basename(pdf_path)
        doc = fitz.open(pdf_path)
        title = doc.metadata.get("title") or filename
        author = doc.metadata.get("author") or "Unknown"
        
        pages_to_process = range(len(doc))
        if max_pages:
            pages_to_process = range(min(len(doc), max_pages))
            
        documents = []
        for page_num in pages_to_process:
            page = doc[page_num]
            raw_text = page.get_text("text")
            cleaned_text = self.clean_and_preserve_latex(raw_text)
            
            documents.append(Document(
                page_content=cleaned_text,
                metadata={
                    "filename": filename,
                    "book_title": title,
                    "author": author,
                    "page_number": page_num + 1
                }
            ))
            
        doc.close()
        return documents

