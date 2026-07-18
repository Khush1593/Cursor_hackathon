"""Aura V6 — FastAPI triage engine (stateless).

POST /triage → Gemini structured output → AuraResponse (frozen Nest contract).
POST /tts    → optional ElevenLabs demo path (Nest owns production TTS).
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException, Request

from config import model_name, use_ai_stub
from llm import run_triage
from models import AuraResponse, TriageRequest, TtsRequest, TtsResponse
from tts import synthesize_to_base64

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [aura-python] %(message)s",
)
logger = logging.getLogger("aura.python")

app = FastAPI(
    title="Aura Triage Engine",
    description="Stateless clinical reasoning service for Aura V6 (Gemini)",
    version="0.6.0",
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s -> %s (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.get("/health")
def health() -> dict[str, str]:
    """Backend / Docker healthcheck — status field is the contract."""
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    """Extra readiness probe for local/demo (Nest only needs /health)."""
    return {
        "status": "ok",
        "model": model_name(),
        "use_ai_stub": use_ai_stub(),
        "version": "0.6.0",
    }


@app.post("/triage", response_model=AuraResponse)
def triage(request: TriageRequest) -> AuraResponse:
    """Run differential triage via Gemini and return a schema-valid AuraResponse."""
    started = time.perf_counter()
    try:
        result = run_triage(request)
    except Exception as exc:
        # Do not invent a fallback here — NestJS owns fallback_responses.json.
        logger.exception("Triage LLM failure")
        raise HTTPException(status_code=502, detail=f"Triage LLM failure: {exc}") from exc

    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "triage ok action=%s mode=%s condition=%s trace=%d (%.0fms)",
        result.action_type,
        result.detected_mode,
        result.detected_condition_id,
        len(result.reasoning_trace),
        elapsed_ms,
    )
    return result


@app.post("/tts", response_model=TtsResponse)
def tts(request: TtsRequest) -> TtsResponse:
    """Convert spoken text to base64 MP3 via ElevenLabs (demo/optional)."""
    audio = synthesize_to_base64(request.text)
    return TtsResponse(audio_base64=audio)
