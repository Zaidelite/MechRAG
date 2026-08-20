from typing import List, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage

ENGINEERING_SYSTEM_PROMPT = """You are an expert Mechanical Engineering AI Assistant specializing in college-level textbooks, fluid mechanics, thermodynamics, heat transfer, and solid mechanics.

Your core duty is to answer student questions accurately, rigorously, and completely with full mathematical derivations and equations.

STRICT RESPONSE & FORMATTING RULES:
1. NO THINKING PROCESS / SCRATCHPAD TAGS:
   - Output ONLY your final textbook response to the student.
   - NEVER output internal thinking blocks, <think>...</think> tags, or reasoning scratchpad text in your answer.

2. LATEX MATHEMATICAL EQUATIONS:
   - EVERY single mathematical symbol, variable, or equation MUST be wrapped in valid KaTeX LaTeX syntax:
     - Wrap inline variables and symbols in single dollar signs: e.g., $p$, $\\rho$, $\\mathbf{{V}}$, $T$, $\\mu$, $Re = \\frac{{\\rho V D}}{{\\mu}}$, $\\frac{{\\partial u}}{{\\partial x}}$.
     - Wrap standalone display equations in double dollar signs placed on their own line:
       $$
       \\rho \\left( \\frac{{\\partial \\mathbf{{V}}}}{{\\partial t}} + \\mathbf{{V}} \\cdot \\nabla \\mathbf{{V}} \\right) = -\\nabla p + \\rho \\mathbf{{g}} + \\mu \\nabla^2 \\mathbf{{V}}
       $$
   - ALWAYS state complete vector and Cartesian component forms of equations when asked about named governing equations (e.g. Navier-Stokes, Euler, Continuity, Bernoulli).

3. DOMAIN KNOWLEDGE & MATHEMATICAL COMPLETENESS:
   - Ground your answer in the provided textbook context snippets and cite page numbers.
   - Whenever context snippets reference standard textbook equations by name (e.g. Navier-Stokes equations, Euler equation, Bernoulli equation, Continuity equation, Reynolds number), ALWAYS provide the complete standard mathematical vector and component equations in clean KaTeX LaTeX syntax.
   - NEVER output meta-complaints about partial text snippets or truncated textbook lines. Provide the complete engineering definition and mathematical formulation clearly.

4. TRACEABLE CITATIONS:
   - When explaining equations or concepts, cite the relevant textbook source and page number in your explanation (e.g., "[White, Page 263]").

Context Snippets:
----------------------------------------
{context}
----------------------------------------
"""

class PromptBuilderService:
    """
    Engineering System Prompt & Context Builder Service.
    Formats retrieved Document chunks with LaTeX math preservation rules and citations,
    supporting multi-turn chat conversation history.
    """
    def __init__(self):
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", ENGINEERING_SYSTEM_PROMPT),
            ("human", "{query}")
        ])

    def format_context_documents(self, documents: List[Document], max_total_chars: int = 24000) -> str:
        """Formats a list of Document objects into structured context text with citations, enforcing max token/char limits to fit API limits."""
        context_parts = []
        accumulated_chars = 0

        for idx, doc in enumerate(documents, start=1):
            meta = doc.metadata or {}
            book_title = meta.get("book_title") or meta.get("filename", "Textbook")
            page = meta.get("page_number") or meta.get("page", "?")
            snippet_text = doc.page_content.strip()

            if accumulated_chars + len(snippet_text) > max_total_chars:
                allowed_len = max_total_chars - accumulated_chars
                if allowed_len > 200:
                    snippet_text = snippet_text[:allowed_len] + "..."
                else:
                    break

            context_parts.append(
                f"[Snippet #{idx} | Source: {book_title}, Page {page}]\n{snippet_text}"
            )
            accumulated_chars += len(snippet_text)

        return "\n\n".join(context_parts)

    def build_prompt_messages(
        self,
        formatted_context: str,
        query: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> List[BaseMessage]:
        """Builds a structured list of LangChain BaseMessage objects including system prompt, context, history, and user query."""
        system_text = ENGINEERING_SYSTEM_PROMPT.format(context=formatted_context)
        messages: List[BaseMessage] = [SystemMessage(content=system_text)]

        # Append last N conversation turns from history
        if history:
            recent_turns = history[-6:] # Keep up to last 6 turns
            for turn in recent_turns:
                role = turn.get("role", "")
                content = turn.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role in ("assistant", "agent"):
                    messages.append(AIMessage(content=content))

        # Append current user query
        messages.append(HumanMessage(content=query))
        return messages

    def get_prompt_template(self) -> ChatPromptTemplate:
        """Returns the underlying LangChain ChatPromptTemplate instance for LCEL chains."""
        return self.prompt_template

