from typing import List, Optional, Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm import LLMService

CLASSIFIER_SYSTEM_PROMPT = """You are a smart query intent classifier for a Mechanical Engineering AI study assistant.
Your task is to determine whether the user's latest message requires searching external textbook documents (RETRIEVAL_NEEDED) or can be answered directly (DIRECT_ANSWER).

CLASSIFICATION CRITERIA:
1. Choose "DIRECT_ANSWER" if:
   - The message is a greeting, pleasantry, acknowledgment, or chit-chat (e.g., "hi", "hello", "good morning", "thank you", "who are you?", "bye").
   - The message is a general conversational remark or general question not requiring textbook references.
   - The message is a follow-up question or clarification that can be answered entirely from the preceding conversation history (e.g., asking to clarify a variable, simplify an algebraic step, or summarize what was already explained in previous turns).
   - The message asks for general advice, formatting changes, or simple calculations.

2. Choose "RETRIEVAL_NEEDED" if:
   - The message asks a new technical engineering question, textbook concept, formula, governing equation, derivation, or problem statement that requires textbook lookup.
   - The message introduces new engineering topics, textbook chapters, or specific textbook problems not yet discussed in the conversation history.

OUTPUT FORMAT:
Respond with EXACTLY ONE word: either "DIRECT_ANSWER" or "RETRIEVAL_NEEDED".
Do NOT include any other text, reasoning, punctuation, or explanations.
"""

class QueryRouterService:
    """
    Intelligent Low-Latency Query Intent Router Service.
    Determines whether a user query requires RAG vector & BM25 retrieval,
    or can be answered directly using LLM reasoning and conversation history.
    """
    def __init__(self, llm_service: Optional[LLMService] = None):
        self.llm_service = llm_service or LLMService()

    def classify_intent(
        self,
        query_text: str,
        history: Optional[List[Dict[str, str]]] = None,
        model_name: Optional[str] = None
    ) -> str:
        """
        Classifies query intent into 'DIRECT_ANSWER' or 'RETRIEVAL_NEEDED'.
        Uses ultra-fast heuristics first (0ms latency), falling back to fast LLM check only when necessary.
        """
        cleaned_query = query_text.strip().lower()
        cleaned_clean = cleaned_query.rstrip("!?. ,")

        # 1. Fast heuristic check: Immediate greetings / chit-chat / small talk (0ms)
        common_greetings = {
            "hi", "hello", "hey", "hey there", "good morning", "good evening",
            "good afternoon", "thanks", "thank you", "thanks a lot", "ok",
            "okay", "bye", "goodbye", "who are you", "what can you do", "help",
            "nice", "cool", "great", "awesome", "understood", "got it", "sure"
        }
        if cleaned_clean in common_greetings:
            return "DIRECT_ANSWER"

        # 2. If fresh conversation (no history), any non-greeting technical question requires retrieval (0ms)
        if not history:
            return "RETRIEVAL_NEEDED"

        # 3. Fast heuristic check: History follow-up patterns (0ms)
        words = set(cleaned_clean.split())
        follow_up_triggers = {
            "what", "why", "how", "simplify", "explain", "meaning", "represent",
            "stands", "unit", "units", "step", "steps", "previous", "above",
            "it", "this", "that", "these", "those", "again", "more", "detail"
        }
        
        # If query is short and clearly asks to explain / clarify previous message
        if len(words) <= 12 and not words.isdisjoint(follow_up_triggers):
            # Check if it doesn't mention a whole new textbook topic
            new_subject_triggers = {"chapter", "textbook", "book", "navier", "bernoulli", "stokes", "carnot", "rankine", "otto", "diesel"}
            if words.isdisjoint(new_subject_triggers):
                return "DIRECT_ANSWER"

        # 4. Fast lightweight LLM check for ambiguous multi-turn messages
        try:
            prompt_content = "Recent Conversation History:\n"
            for turn in history[-3:]:
                role = turn.get("role", "unknown")
                content = turn.get("content", "")[:300] # Cap chars for fast processing
                prompt_content += f"{role.capitalize()}: {content}\n"

            prompt_content += f"\nLatest User Message: {query_text}\n\nClassification:"

            messages = [
                SystemMessage(content=CLASSIFIER_SYSTEM_PROMPT),
                HumanMessage(content=prompt_content)
            ]

            # Use fast low-latency model if possible (Gemini Flash or Groq Compound)
            fast_model = "gemini-2.5-flash"
            response = self.llm_service.generate_response(messages, model_name=fast_model).strip()
            
            if "DIRECT_ANSWER" in response.upper():
                return "DIRECT_ANSWER"
            return "RETRIEVAL_NEEDED"
        except Exception:
            # Safe fallback to standard RAG retrieval on any error
            return "RETRIEVAL_NEEDED"
