import os
import re
import glob
import fitz  # PyMuPDF
from langchain_core.documents import Document

SAMPLE_PDF_DIR = os.path.join(os.path.dirname(__file__), "sample_pdfs")

# Character mapping dictionary for common PDF mathematical font glyphs -> LaTeX syntax
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

def clean_and_preserve_latex(text: str) -> str:
    """Cleans control codes and converts mathematical expressions into valid LaTeX syntax."""
    # 1. Map math glyphs
    for char, latex in MATH_GLYPH_MAP.items():
        text = text.replace(char, latex)
        
    # 2. Convert common equation patterns to LaTeX math delimiters
    lines = text.split("\n")
    processed_lines = []
    
    for line in lines:
        stripped = line.strip()
        # If line looks like a display equation (contains =, \partial, \nabla, \int, \rho)
        if re.search(r'(=|\\partial|\\nabla|\\int|\\sum|\\rho|\\mu|\\sigma)\s*', stripped) and len(stripped) < 120 and not stripped.endswith("."):
            # Enclose as display math block if not already enclosed
            if not stripped.startswith("$"):
                processed_lines.append(f"\n$$\n{stripped}\n$$\n")
            else:
                processed_lines.append(line)
        else:
            # Enclose inline math expressions if present
            line_cleaned = re.sub(r'(\b[a-zA-Z]\b\s*=\s*[^,\n\.]+)', r'$\1$', line)
            processed_lines.append(line_cleaned)
            
    return "\n".join(processed_lines)

def count_latex_formulas(text: str) -> dict:
    """Counts inline ($...$) and block ($$...$$) LaTeX formulas in extracted text."""
    inline_math = len(re.findall(r'(?<!\$)\$[^$\n]+\$(?!\$)', text))
    block_math = len(re.findall(r'\$\$[\s\S]*?\$\$', text))
    return {"inline_latex": inline_math, "block_latex": block_math, "total_latex": inline_math + block_math}

def parse_pdf_to_documents(pdf_path: str, max_pages: int = None) -> list[Document]:
    """
    Fast PyMuPDF PDF Parser with LaTeX Math preserving normalizers (sub-second execution).
    """
    filename = os.path.basename(pdf_path)
    doc = fitz.open(pdf_path)
    title = doc.metadata.get("title") or filename
    author = doc.metadata.get("author") or "Unknown"
    
    pages_to_process = range(len(doc))
    if max_pages:
        pages_to_process = range(min(len(doc), max_pages))
        
    documents = []
    print(f"⚡ Fast PyMuPDF Parsing {len(pages_to_process)} pages from '{filename}'...")
    
    for page_num in pages_to_process:
        page = doc[page_num]
        raw_text = page.get_text("text")
        cleaned_text = clean_and_preserve_latex(raw_text)
        
        f_stats = count_latex_formulas(cleaned_text)
        print(f"   ↳ [Page {page_num + 1}/{len(pages_to_process)}] Processed {len(cleaned_text)} chars | {f_stats['total_latex']} LaTeX formulas format-preserved.")
        
        documents.append(Document(
            page_content=cleaned_text,
            metadata={
                "filename": filename,
                "book_title": title,
                "author": author,
                "page": page_num + 1
            }
        ))
        
    doc.close()
    print(f"✅ PyMuPDF fast parser completed {len(documents)} page documents in milliseconds.")
    return documents

def test_pdf_parsing(pdf_path: str, max_pages: int = None):
    doc_name = os.path.basename(pdf_path)
    print(f"\n==========================================")
    print(f"Fast PyMuPDF PDF Text & LaTeX Parser: {doc_name}")
    print(f"==========================================")
    
    documents = parse_pdf_to_documents(pdf_path, max_pages=max_pages)
    
    if documents:
        sample_page = documents[min(5, len(documents) - 1)]
        full_text = "\n".join([doc.page_content for doc in documents])
        latex_counts = count_latex_formulas(full_text)
        
        print(f"\n--- Sample Page Snippet (Page {sample_page.metadata.get('page', 1)}) ---")
        print(sample_page.page_content[:600])
        print("\n--- Document Metadata & Formula Metrics ---")
        print(f"Metadata: {sample_page.metadata}")
        print(f"LaTeX Formulas Detected: {latex_counts['total_latex']} (Inline: {latex_counts['inline_latex']}, Block: {latex_counts['block_latex']})")
        return documents
    return []

if __name__ == "__main__":
    pdf_files = glob.glob(os.path.join(SAMPLE_PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {SAMPLE_PDF_DIR}. Please place a textbook PDF there!")
    else:
        for pdf_file in pdf_files:
            test_pdf_parsing(pdf_file, max_pages=10)



