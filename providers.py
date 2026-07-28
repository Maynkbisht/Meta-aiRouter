"""AI Provider registry and base classes.

This module defines the Provider interface and implementations for different AI backends.
To add a new provider (e.g., Gemini, Claude, GPT-4):

1. Create a class inheriting from Provider
2. Implement the call() method
3. Add it to the PROVIDERS list at the bottom
"""

import os
import requests
import urllib3
from typing import List, Dict, Any


print("=" * 40)

print("OPENAI_API_KEY:", bool(os.environ.get("OPENAI_API_KEY")))

print("GEMINI_API_KEY:", bool(os.environ.get("GEMINI_API_KEY")))

print("CLAUDE_API_KEY:", bool(os.environ.get("CLAUDE_API_KEY")))

print("=" * 40)

# Disable SSL warnings for macOS compatibility
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class Provider:
    """Base class for AI providers."""

    def __init__(self, id: str, name: str, strengths: List[str], quality: float = 0.8):
        self.id = id
        self.name = name
        self.strengths = strengths
        self.quality = float(quality)

    def call(self, prompt: str) -> Dict[str, Any]:
        raise NotImplementedError()


class GeminiProvider(Provider):
    """Google Gemini API provider."""

    def __init__(self):
        super().__init__(
            id="gemini",
            name="Gemini (Google)",
            strengths=["language_prompt", "general_prompt"],
            quality=0.90,
        )
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {"success": False, "error": "Gemini API key not configured. Set GEMINI_API_KEY."}

        url = f"{self.base_url}?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        try:
            r = requests.post(url, headers=headers, json=payload, timeout=30, verify=False)
            r.raise_for_status()
            data = r.json()

            answer = ""
            try:
                answer = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                ).strip()
            except Exception:
                answer = ""

            if not answer:
                return {"success": False, "error": f"Empty response from Gemini: {str(data)[:200]}"}

            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Gemini request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {"success": False, "error": f"Gemini connection error: {str(e)[:100]}"}
        except Exception as e:
            return {"success": False, "error": f"Gemini error: {str(e)[:100]}"}


class OpenAIProvider(Provider):
    """OpenAI GPT API provider."""

    def __init__(self):
        super().__init__(
            id="openai",
            name="OpenAI",
            strengths=["general_prompt", "math_prompt", "language_prompt"],
            quality=0.93,
        )
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.base_url = "https://api.openai.com/v1/chat/completions"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {"success": False, "error": "OpenAI API key not configured. Set OPENAI_API_KEY."}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 500,
        }

        try:
            r = requests.post(self.base_url, headers=headers, json=payload, timeout=30, verify=False)
            r.raise_for_status()
            data = r.json()
            answer = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not answer:
                return {"success": False, "error": f"Empty response from OpenAI: {str(data)[:200]}"}
            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "OpenAI request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {"success": False, "error": f"OpenAI connection error: {str(e)[:100]}"}
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return {"success": False, "error": "OpenAI rate limit exceeded - trying next provider"}
            return {"success": False, "error": f"OpenAI HTTP error {e.response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"OpenAI error: {str(e)[:100]}"}


class ClaudeProvider(Provider):
    """Anthropic Claude API provider."""

    def __init__(self):
        super().__init__(
            id="claude",
            name="Claude (Anthropic)",
            strengths=["general_prompt", "language_prompt"],
            quality=0.92,
        )
        self.api_key = os.environ.get("CLAUDE_API_KEY")
        self.base_url = "https://api.anthropic.com/v1/messages"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {"success": False, "error": "Claude API key not configured. Set CLAUDE_API_KEY."}

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            r = requests.post(self.base_url, headers=headers, json=payload, timeout=30, verify=False)
            r.raise_for_status()
            data = r.json()
            answer = data.get("content", [{}])[0].get("text", "").strip()
            if not answer:
                return {"success": False, "error": f"Empty response from Claude: {str(data)[:200]}"}
            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Claude request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {"success": False, "error": f"Claude connection error: {str(e)[:100]}"}
        except Exception as e:
            return {"success": False, "error": f"Claude error: {str(e)[:100]}"}


class LocalEchoProvider(Provider):
    """Local fallback provider — always succeeds, no API key needed.

    Handles math expressions precisely; gives a helpful fallback for everything else.
    This ensures the app always returns *something* even when all API keys are missing.
    """

    def __init__(self):
        super().__init__(
            id="local_echo",
            name="Local Echo (dev fallback)",
            # Listed last — only wins when all real providers fail or are unkeyed
            strengths=["math_prompt", "general_prompt", "language_prompt"],
            quality=0.1,   # Low quality keeps it at the bottom of the ranking
        )

    def call(self, prompt: str) -> Dict[str, Any]:
        import re

        # ── Try simple arithmetic ──────────────────────────────────────────
        expr_match = re.search(
            r"(\d+(?:\.\d+)?)\s*([\+\-\*\/\^])\s*(\d+(?:\.\d+)?)", prompt
        )
        if expr_match:
            try:
                num1, op, num2 = expr_match.groups()
                safe_op = op.replace("^", "**")
                result = eval(f"{num1}{safe_op}{num2}")  # noqa: S307 — digits only
                return {
                    "success": True,
                    "response": f"The answer to **{num1} {op} {num2}** is **{result}**.",
                }
            except Exception as e:
                pass  # fall through to generic response

        # ── Generic fallback ──────────────────────────────────────────────
        preview = prompt[:120].rstrip()
        return {
            "success": True,
            "response": (
                "⚠️ **No AI provider is currently configured.**\n\n"
                f"Your question was: *\"{preview}{'…' if len(prompt) > 120 else ''}\"*\n\n"
                "To get real AI responses, add at least one API key to your `.env` file:\n\n"
                "```\nGEMINI_API_KEY=your_key_here\n"
                "OPENAI_API_KEY=your_key_here\n"
                "CLAUDE_API_KEY=your_key_here\n```\n\n"
                "Then restart the server with `python app.py`."
            ),
        }


PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    ClaudeProvider(),
    LocalEchoProvider(),   # Always last — guaranteed fallback
]


def get_provider_by_id(provider_id: str):
    """Look up a provider by its ID."""
    for p in PROVIDERS:
        if p.id == provider_id:
            return p
    return None


def list_providers():
    """Return a list of available provider info."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "strengths": p.strengths,
            "quality": p.quality,
        }
        for p in PROVIDERS
    ]
