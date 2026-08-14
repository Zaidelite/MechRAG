import os
from typing import Optional, Dict, List
from concurrent.futures import ThreadPoolExecutor
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings

class LLMService:
    """
    Google Gemini LLM Service wrapper supporting dynamic, verified model selection.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model_name: Optional[str] = None,
        temperature: float = 0.2
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        self.default_model_name = default_model_name or settings.LLM_MODEL or "gemini-2.5-flash"
        self.temperature = temperature
        self._clients: Dict[str, ChatGoogleGenerativeAI] = {}
        self._verified_models: Optional[List[Dict[str, str]]] = None

        if not self.api_key:
            print("⚠️ Warning: GEMINI_API_KEY / GOOGLE_API_KEY is not configured.")

    def _verify_single_model(self, candidate: Dict[str, str]) -> Optional[Dict[str, str]]:
        """Probes a single model ID to confirm it is active and available for the current API key."""
        model_id = candidate["id"]
        try:
            client = ChatGoogleGenerativeAI(
                model=model_id,
                google_api_key=self.api_key,
                temperature=self.temperature
            )
            # Quick lightweight probe
            res = client.invoke("Hi")
            if res and hasattr(res, "content"):
                return candidate
            return None
        except Exception as e:
            print(f"Skipping model '{model_id}' for current API key: {e}")
            return None

    def _verify_and_list_models(self) -> List[Dict[str, str]]:
        """Queries Google Gemini API for candidate generation models and verifies availability for the active key."""
        if not self.api_key:
            return []

        try:
            client = genai.Client(api_key=self.api_key)
            candidates = []

            for m in client.models.list():
                actions = getattr(m, "supported_actions", []) or getattr(m, "supported_generation_methods", [])
                clean_id = m.name.replace("models/", "")

                if "generateContent" in actions:
                    lower_id = clean_id.lower()
                    # Filter out non-chat, image, tts, robotics, or deprecated preview models
                    if any(bad in lower_id for bad in [
                        "tts", "lyria", "robotics", "image", "embed", "aqa",
                        "imagen", "veo", "translate", "banana", "preview-0",
                        "preview-1", "computer-use"
                    ]):
                        continue

                    display_name = getattr(m, "display_name", clean_id)
                    candidates.append({
                        "id": clean_id,
                        "name": display_name,
                        "description": getattr(m, "description", "")
                    })

            if not candidates:
                candidates = [{
                    "id": self.default_model_name,
                    "name": "Gemini 2.5 Flash",
                    "description": "Default Google Gemini model"
                }]

            # Concurrently verify candidate models
            verified = []
            with ThreadPoolExecutor(max_workers=5) as executor:
                results = list(executor.map(self._verify_single_model, candidates))

            for r in results:
                if r is not None:
                    verified.append(r)

            # Fallback to default model if verification yields empty
            if not verified:
                verified = [{
                    "id": self.default_model_name,
                    "name": "Gemini 2.5 Flash",
                    "description": "Default Google Gemini model"
                }]

            # Prioritize default model at the top of the list
            verified.sort(key=lambda x: 0 if x["id"] == self.default_model_name else 1)
            return verified

        except Exception as e:
            print("Error listing models via google-genai:", e)
            return [{
                "id": self.default_model_name,
                "name": "Gemini 2.5 Flash",
                "description": "Default Google Gemini model"
            }]

    def list_available_models(self) -> List[Dict[str, str]]:
        """Returns cached verified models for the active API key."""
        if self._verified_models is None:
            self._verified_models = self._verify_and_list_models()
        return self._verified_models

    def get_llm_client(self, model_name: Optional[str] = None) -> ChatGoogleGenerativeAI:
        """Returns or instantiates a LangChain ChatGoogleGenerativeAI instance for the requested model."""
        target_model = model_name or self.default_model_name
        if target_model not in self._clients:
            self._clients[target_model] = ChatGoogleGenerativeAI(
                model=target_model,
                google_api_key=self.api_key,
                temperature=self.temperature,
                convert_system_message_to_human=True
            )
        return self._clients[target_model]

    def generate_response(self, prompt_text: str, model_name: Optional[str] = None) -> str:
        """Invokes Gemini LLM with formatted prompt string for specified or default model."""
        target_model = model_name or self.default_model_name
        try:
            client = self.get_llm_client(target_model)
            response = client.invoke(prompt_text)
            content = response.content
            if isinstance(content, str):
                return content
            elif isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, dict) and "text" in item:
                        text_parts.append(item["text"])
                    elif hasattr(item, "text"):
                        text_parts.append(getattr(item, "text"))
                return "".join(text_parts)
            return str(content)
        except Exception as e:
            err_msg = str(e)
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                return (
                    f"⚠️ [Gemini Rate Limit / Quota Exceeded]\n\n"
                    f"The model **`{target_model}`** has reached its API request quota for this key.\n\n"
                    f"💡 **Recommendation**: Please switch to another verified model in the dropdown above or update your `GEMINI_API_KEY` in `backend/.env`."
                )
            elif "NOT_FOUND" in err_msg or "404" in err_msg:
                return (
                    f"⚠️ [Gemini Model Not Available]\n\n"
                    f"The model **`{target_model}`** is not available for this API key. Please select a different model from the model selector."
                )
            elif "API_KEY_INVALID" in err_msg or "INVALID_ARGUMENT" in err_msg:
                return (
                    "⚠️ [Gemini API Key Error]\n"
                    f"Error calling Gemini API: {err_msg}\n\n"
                    "Please check your API key in `backend/.env`."
                )
            return (
                f"⚠️ [Gemini API Error]\n\n"
                f"Error calling model **`{target_model}`**: {err_msg}"
            )
