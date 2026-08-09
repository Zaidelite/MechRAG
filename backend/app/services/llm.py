import os
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings

class LLMService:
    """
    Google Gemini LLM Service wrapper.
    Uses 'gemini-2.5-flash' for fast, accurate mechanical engineering Q&A with LaTeX output.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        self.model_name = model_name or settings.LLM_MODEL or "gemini-2.5-flash"
        self.temperature = temperature
        
        if not self.api_key:
            print("⚠️ Warning: GEMINI_API_KEY / GOOGLE_API_KEY is not configured.")

        self._llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=self.api_key,
            temperature=self.temperature,
            convert_system_message_to_human=True
        )

    def get_llm_client(self) -> ChatGoogleGenerativeAI:
        """Returns the underlying LangChain ChatGoogleGenerativeAI instance for LCEL chains."""
        return self._llm

    def generate_response(self, prompt_text: str) -> str:
        """Invokes Gemini LLM with formatted prompt string."""
        try:
            response = self._llm.invoke(prompt_text)
            return response.content
        except Exception as e:
            err_msg = str(e)
            if "API_KEY_INVALID" in err_msg or "INVALID_ARGUMENT" in err_msg:
                return (
                    "⚠️ [Gemini API Key Error]\n"
                    f"Error calling Gemini API: {err_msg}\n\n"
                    "Please check your API key in `backend/.env`."
                )
            raise e



