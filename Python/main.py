"""Aura V5 — FastAPI triage engine (stateless).

POST /triage → Gemini structured output → AuraResponse.
"""

from fastapi import FastAPI, HTTPException

from llm import run_triage
from models import AuraResponse, TriageRequest

app = FastAPI(
    title="Aura Triage Engine",
    description="Stateless clinical reasoning service for Aura V5 (Gemini)",
    version="0.4.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Backend / Docker healthcheck."""
    return {"status": "ok"}


@app.post("/triage", response_model=AuraResponse)
def triage(request: TriageRequest) -> AuraResponse:
    """Run differential triage via Gemini and return a schema-valid AuraResponse."""
    try:
        return run_triage(request)
    except Exception as exc:
        # Do not invent a fallback here — NestJS owns fallback_responses.json.
        raise HTTPException(status_code=502, detail=f"Triage LLM failure: {exc}") from exc
