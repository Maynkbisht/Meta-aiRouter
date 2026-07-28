"""API handler that routes prompts to registered providers and returns responses.

This module uses the providers registry in `providers.py`. It scores providers
based on overlap between classifier categories/keywords and provider strengths,
plus provider quality score. To add new providers, add them to
`providers.PROVIDERS`.
"""

from typing import Dict, Any
import math
from providers import PROVIDERS, get_provider_by_id


def _score_provider(prompt_category: str, keyword_matches: list, provider) -> float:
    """Simple scoring: base on overlap between keyword_matches and provider.strengths,
    plus a small boost if provider explicitly supports the prompt_category, scaled by quality.
    """
    score = 0.0
    if not provider:
        return score
    # exact category match gets a boost
    if prompt_category in getattr(provider, "strengths", []):
        score += 0.6
    # keyword overlap
    overlap = 0
    for k in keyword_matches or []:
        if k in getattr(provider, "strengths", []):
            overlap += 1
    if keyword_matches:
        score += 0.2 * (overlap / max(1, len(keyword_matches)))
    # quality factor
    score += 0.2 * getattr(provider, "quality", 0.5)
    # normalize to 0..1
    return max(0.0, min(1.0, score))


class api_handler:
    @staticmethod
    def call_ai_api(
        prompt: str, prompt_category: str, keyword_matches: list = None
    ) -> Dict[str, Any]:
        """Selects a provider and calls it. Returns dict {success, response, provider, provider_name, error, raw}.

        - prompt_category: classification category string (e.g., 'math_prompt')
        - keyword_matches: optional list of keywords extracted by classifier

        Tries providers in order of score. If top provider fails, tries next best.
        """
        # Score all providers and sort by score
        scored_providers = []
        for p in PROVIDERS:
            s = _score_provider(prompt_category, keyword_matches or [], p)
            scored_providers.append((s, p))

        # Sort by score (highest first)
        scored_providers.sort(key=lambda x: x[0], reverse=True)

        if not scored_providers:
            return {"success": False, "error": "No AI providers available."}

        # Try providers in order until one succeeds
     last_error = None

for score, provider in scored_providers:
    result = provider.call(prompt)

    if result.get("success"):
        return {
            ...
        }
    else:
        last_error = result.get("error", "Provider error")
        continue

        # All providers failed
        return {
            "success": False,
            "error": f"All providers failed. Last error: {last_error}",
            "provider": "none",
            "provider_name": "None",
        }
