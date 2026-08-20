import os
from typing import Optional, Dict, List, Any
from groq import Groq
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings

import re

def normalize_latex_delimiters(text: str) -> str:
    """Standardizes \(...\) and \[...\] LaTeX math syntax to $...$ and $$...$$."""
    if not text:
        return text
    text = text.replace(r"\[", "\n$$\n").replace(r"\]", "\n$$\n")
    text = text.replace(r"\(", "$").replace(r"\)", "$")
    return text

def clean_think_tags(text: str) -> str:
    """Strips <think>...</think> blocks from LLM generated response with safety fallback."""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    cleaned = re.sub(r'^<think>.*$', '', cleaned, flags=re.DOTALL)
    cleaned = cleaned.strip()
    if not cleaned and '<think>' in text:
        # Fallback if reasoning model put entire answer inside <think>
        cleaned = re.sub(r'</?think>', '', text).strip()
    return normalize_latex_delimiters(cleaned)

class ThinkTagStreamFilter:
    """Stateful stream filter to suppress <think>...</think> reasoning blocks in real-time token streaming."""
    def __init__(self):
        self.in_think = False
        self.buffer = ""

    def filter_chunk(self, chunk: str) -> str:
        self.buffer += chunk
        emitted = []

        while self.buffer:
            if not self.in_think:
                think_start = self.buffer.find("<think>")
                if think_start != -1:
                    if think_start > 0:
                        emitted.append(self.buffer[:think_start])
                    self.buffer = self.buffer[think_start + len("<think>"):]
                    self.in_think = True
                else:
                    # check for potential start of '<think>' at the end of buffer
                    partial_match = False
                    for i in range(1, len("<think>")):
                        if self.buffer.endswith("<think>"[:i]):
                            if len(self.buffer) > i:
                                emitted.append(self.buffer[:-i])
                                self.buffer = self.buffer[-i:]
                            partial_match = True
                            break
                    if not partial_match:
                        emitted.append(self.buffer)
                        self.buffer = ""
            else:
                think_end = self.buffer.find("</think>")
                if think_end != -1:
                    self.buffer = self.buffer[think_end + len("</think>"):].lstrip()
                    self.in_think = False
                else:
                    self.buffer = ""
                    break

        return normalize_latex_delimiters("".join(emitted))

    def flush(self) -> str:
        if not self.in_think and self.buffer:
            res = self.buffer
            self.buffer = ""
            return normalize_latex_delimiters(res)
        return ""

class LLMService:
    """
    Unified Groq & Gemini LLM Service wrapper supporting dynamic model selection and real-time SSE streaming.
    """
    def __init__(
        self,
        groq_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        default_model_name: Optional[str] = None,
        temperature: float = 0.2
    ):
        self.groq_api_key = groq_api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        self.gemini_api_key = gemini_api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        self.default_model_name = default_model_name or settings.LLM_MODEL or "qwen/qwen3.6-27b"
        self.temperature = temperature
        self._clients: Dict[str, Any] = {}
        self._cached_models: Optional[List[Dict[str, str]]] = None

    def _fetch_groq_models(self) -> List[Dict[str, str]]:
        if not self.groq_api_key:
            return []
        try:
            client = Groq(api_key=self.groq_api_key)
            models_list = client.models.list().data
            formatted = []
            for m in models_list:
                m_id = m.id
                # Exclude audio/whisper/guard models
                if any(bad in m_id.lower() for bad in ["whisper", "prompt-guard", "audio", "orpheus"]):
                    continue
                clean_name = m_id.split("/")[-1].replace("-", " ").title()
                formatted.append({
                    "id": m_id,
                    "name": f"{clean_name} (Groq)",
                    "description": f"Groq LPU accelerated model: {m_id}"
                })
            return formatted
        except Exception as e:
            print("Error fetching Groq models:", e)
            return [
                {"id": "qwen/qwen3.6-27b", "name": "Qwen 3.6 27B (Groq)", "description": "Qwen 3.6 27B model on Groq"},
                {"id": "openai/gpt-oss-120b", "name": "GPT OSS 120B (Groq)", "description": "GPT OSS 120B model on Groq"}
            ]

    def get_llm_client(self, model_name: Optional[str] = None):
        """Instantiates or returns a cached LangChain LLM client (ChatGroq or ChatGoogleGenerativeAI)."""
        target_model = model_name or self.default_model_name

        if target_model not in self._clients:
            if target_model.startswith("gemini"):
                if not self.gemini_api_key:
                    raise ValueError("GEMINI_API_KEY is not configured in environment.")
                self._clients[target_model] = ChatGoogleGenerativeAI(
                    model=target_model,
                    google_api_key=self.gemini_api_key,
                    temperature=self.temperature,
                    max_output_tokens=4096,
                    convert_system_message_to_human=True
                )
            else:
                if not self.groq_api_key:
                    raise ValueError("GROQ_API_KEY is not configured in environment.")
                self._clients[target_model] = ChatGroq(
                    model=target_model,
                    groq_api_key=self.groq_api_key,
                    temperature=self.temperature,
                    max_tokens=4096
                )

        return self._clients[target_model]

    def list_available_models(self) -> List[Dict[str, str]]:
        """Returns list of available Groq and Gemini models."""
        if self._cached_models is not None:
            return self._cached_models

        available = []
        if self.groq_api_key:
            available.extend(self._fetch_groq_models())
        if self.gemini_api_key:
            available.extend([
                {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "description": "Google Gemini 2.5 Flash"},
                {"id": "gemini-3.6-flash", "name": "Gemini 3.6 Flash", "description": "Google Gemini 3.6 Flash"}
            ])

        if not available:
            available = [
                {"id": "qwen/qwen3.6-27b", "name": "Qwen 3.6 27B (Groq)", "description": "Qwen 3.6 27B model on Groq"}
            ]

        available.sort(key=lambda x: 0 if x["id"] == self.default_model_name else 1)
        self._cached_models = available
        return available

    def generate_response(self, prompt_input: Any, model_name: Optional[str] = None) -> str:
        """Invokes LLM (Groq / Gemini) with formatted prompt string or message list."""
        target_model = model_name or self.default_model_name
        try:
            client = self.get_llm_client(target_model)
            response = client.invoke(prompt_input)
            content = response.content
            raw_text = ""
            if isinstance(content, str):
                raw_text = content
            elif isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, dict) and "text" in item:
                        text_parts.append(item["text"])
                    elif hasattr(item, "text"):
                        text_parts.append(getattr(item, "text"))
                raw_text = "".join(text_parts)
            else:
                raw_text = str(content)
            return clean_think_tags(raw_text)
        except Exception as e:
            err_msg = str(e)
            return f"⚠️ [LLM Provider Error ({target_model})]: {err_msg}"

    def stream_response(self, prompt_input: Any, model_name: Optional[str] = None):
        """Streams LLM response tokens (Groq / Gemini) with formatted prompt string or message list, filtering out <think> tags."""
        target_model = model_name or self.default_model_name
        stream_filter = ThinkTagStreamFilter()
        try:
            client = self.get_llm_client(target_model)
            for chunk in client.stream(prompt_input):
                content = chunk.content
                token = ""
                if isinstance(content, str):
                    token = content
                elif isinstance(content, list):
                    text_parts = []
                    for item in content:
                        if isinstance(item, str):
                            text_parts.append(item)
                        elif isinstance(item, dict) and "text" in item:
                            text_parts.append(item["text"])
                        elif hasattr(item, "text"):
                            text_parts.append(getattr(item, "text"))
                    token = "".join(text_parts)
                elif hasattr(chunk, "text"):
                    token = chunk.text

                if token:
                    filtered = stream_filter.filter_chunk(token)
                    if filtered:
                        yield filtered

            final_flush = stream_filter.flush()
            if final_flush:
                yield final_flush

        except Exception as e:
            err_msg = str(e)
            yield f"\n\n⚠️ [LLM Streaming Error ({target_model})]: {err_msg}"


