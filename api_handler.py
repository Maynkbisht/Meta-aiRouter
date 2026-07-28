"""API handler that routes prompts to registered providers and returns responses.

This module uses the providers registry in `providers.py`. It scores providers
based on overlap between classifier categories/keywords and provider strengths,
plus provider quality score.
"""

from typing import Dict, Any
from providers import PROVIDERS


def _score_provider(prompt_category: str, keyword_matches: list, provider) -> float:
    """Score providers based on category, keyword overlap and quality."""
    score = 0.0

    if not provider:
        return score

    # Category match
    if prompt_category in getattr(provider, "strengths", []):
        score += 0.6

    # Keyword overlap
    overlap = 0
    for keyword in keyword_matches or []:
        if keyword in getattr(provider, "strengths", []):
            overlap += 1

    if keyword_matches:
        score += 0.2 * (overlap / max(1, len(keyword_matches)))

    # Quality boost
    score += 0.2 * getattr(provider, "quality", 0.5)

    return max(0.0, min(1.0, score))


class api_handler:
    @staticmethod
    def call_ai_api(
        prompt: str,
        prompt_category: str,
        keyword_matches: list = None,
    ) -> Dict[str, Any]:

        # Score providers
        scored_providers = []

        for provider in PROVIDERS:
            score = _score_provider(
                prompt_category,
                keyword_matches or [],
                provider,
            )
            scored_providers.append((score, provider))

        # Highest score first
        scored_providers.sort(key=lambda x: x[0], reverse=True)

        if not scored_providers:
            return {
                "success": False,
                "error": "No AI providers available.",
            }

        last_error = None

        # Try each provider
        for score, provider in scored_providers:

            print(f"\nTrying provider: {provider.name}")

            result = provider.call(prompt)

            print(result)

            if result.get("success"):
                print(f"SUCCESS -> {provider.name}")

                return {
                    "success": True,
                    "response": result.get("response", ""),
                    "provider": provider.id,
                    "provider_name": provider.name,
                    "raw": result.get("raw"),
                }

            print(f"FAILED -> {provider.name}: {result.get('error')}")

            last_error = result.get("error", "Provider error")

        # All failed
        return {
            "success": False,
            "error": f"All providers failed.\nLast error: {last_error}",
            "provider": "none",
            "provider_name": "None",
        }
