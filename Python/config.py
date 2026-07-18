"""Central env/config for the Aura Python triage service."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def gemini_api_key() -> str | None:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return key or None


def model_name() -> str:
    return os.getenv("MODEL_NAME", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def use_ai_stub() -> bool:
    return os.getenv("USE_AI_STUB", "0").strip().lower() in {"1", "true", "yes"}


def llm_timeout_seconds() -> float:
    """Hard ceiling for a single Gemini call (Nest should fail open to fallback)."""
    raw = os.getenv("LLM_TIMEOUT_SECONDS", "45").strip()
    try:
        value = float(raw)
    except ValueError:
        return 45.0
    return max(5.0, min(value, 120.0))


def elevenlabs_api_key() -> str | None:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    return key or None


def elevenlabs_voice_id() -> str:
    return (
        os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()
        or "21m00Tcm4TlvDq8ikWAM"
    )


def elevenlabs_model_id() -> str:
    return (
        os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2").strip()
        or "eleven_multilingual_v2"
    )
