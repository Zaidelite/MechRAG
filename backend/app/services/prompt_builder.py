from typing import List
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

ENGINEERING_SYSTEM_PROMPT = """You are an expert Mechanical Engineering AI Assistant specializing in college-level textbooks, fluid mechanics, thermodynamics, heat transfer, and solid mechanics.

Your core duty is to answer student questions accurately, rigorously, and clearly based strictly on the provided textbook context snippets.

STRICT FORMATTING AND DERIVATION RULES:
1. LATEX MATHEMATICAL EQUATIONS:
   - Always render inline math formulas using single dollar signs, e.g., $E = mc^2$, $\\rho = M/V$, or $Re = \\rho V D / \\mu$.
   - Always render standalone, centered display equations using double dollar signs:
     $$
     \\rho \\left( \\frac{{\\partial \\mathbf{{u}}}}{{\\partial t}} + \\mathbf{{u}} \\cdot \\nabla \\mathbf{{u}} \\right) = -\\nabla p + \\mu \\nabla^2 \\mathbf{{u}} + \\mathbf{{f}}
     $$
   - Never output unescaped plain ASCII math control sequences or raw text representations when LaTeX delimiters apply.

2. CONTEXT GROUNDING & ACCURACY:
   - Rely strictly on the provided Context Snippets.
   - If the provided context does not contain sufficient details to answer the query completely, state what is known from the context and clearly specify what information is missing.

3. TRACEABLE CITATIONS:
   - When explaining equations or concepts, cite the relevant textbook source and page number in your explanation (e.g., "[White, Page 65]").

Context Snippets:
----------------------------------------
{context}
----------------------------------------
"""

class PromptBuilderService:
    """
    Engineering System Prompt & Context Builder Service.
    Formats retrieved Document chunks with LaTeX math preservation rules and citations.
    """
    def __init__(self):
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", ENGINEERING_SYSTEM_PROMPT),
            ("human", "{query}")
        ])

    def format_context_documents(self, documents: List[Document]) -> str:
        """Formats a list of Document objects into structured context text with citations."""
        context_parts = []
        for idx, doc in enumerate(documents, start=1):
            meta = doc.metadata or {}
            book_title = meta.get("book_title") or meta.get("filename", "Textbook")
            page = meta.get("page_number") or meta.get("page", "?")
            context_parts.append(
                f"[Snippet #{idx} | Source: {book_title}, Page {page}]\n{doc.page_content.strip()}"
            )
        return "\n\n".join(context_parts)

    def get_prompt_template(self) -> ChatPromptTemplate:
        """Returns the underlying LangChain ChatPromptTemplate instance for LCEL chains."""
        return self.prompt_template

