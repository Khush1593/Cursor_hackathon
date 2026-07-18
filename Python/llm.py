"""Gemini LLM client for Aura triage (structured JSON → AuraResponse)."""

from __future__ import annotations

import json
import os
from typing import Literal, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from models import AuraResponse, PendingTriage, TriageRequest
from prompt import build_messages

load_dotenv()

ALLOWED_METRIC_KEYS = frozenset({"pain_level", "sleep_hours"})

# Gemini-friendly schema (no Dict[str, Any] — that breaks response_schema).
class ExtractedMetrics(BaseModel):
    pain_level: Optional[int] = Field(default=None, ge=1, le=10)
    sleep_hours: Optional[int] = Field(default=None, ge=0, le=24)


class AuraLLMSchema(BaseModel):
    action_type: Literal[
        "ask_follow_up",
        "resolve",
        "emergency_escalation",
        "general_response",
    ]
    detected_mode: Literal["preventive", "urgent_care", "emergency"]
    detected_condition_id: Optional[str] = None
    extracted_dashboard_metrics: ExtractedMetrics = Field(
        default_factory=ExtractedMetrics
    )
    ai_spoken_response: str
    trigger_exa_search: Optional[str] = None
    pending_triage_update: Optional[PendingTriage] = None


def _use_stub() -> bool:
    return os.getenv("USE_AI_STUB", "0").strip() in {"1", "true", "True", "yes"}


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment / .env")
    return genai.Client(api_key=api_key)


def _model_name() -> str:
    return os.getenv("MODEL_NAME", "gemini-2.5-flash").strip()


def _metrics_to_dict(metrics: ExtractedMetrics) -> dict:
    raw = metrics.model_dump(exclude_none=True)
    return {k: v for k, v in raw.items() if k in ALLOWED_METRIC_KEYS}


def _to_aura_response(parsed: AuraLLMSchema) -> AuraResponse:
    return AuraResponse(
        action_type=parsed.action_type,
        detected_mode=parsed.detected_mode,
        detected_condition_id=parsed.detected_condition_id,
        extracted_dashboard_metrics=_metrics_to_dict(parsed.extracted_dashboard_metrics),
        ai_spoken_response=parsed.ai_spoken_response,
        trigger_exa_search=parsed.trigger_exa_search,
        pending_triage_update=parsed.pending_triage_update,
    )


def _sanitize_aura(response: AuraResponse) -> AuraResponse:
    """Belt-and-suspenders: drop any metric keys outside the frozen chart contract."""
    cleaned = {
        k: v
        for k, v in response.extracted_dashboard_metrics.items()
        if k in ALLOWED_METRIC_KEYS
    }
    if cleaned == response.extracted_dashboard_metrics:
        return response
    return response.model_copy(update={"extracted_dashboard_metrics": cleaned})


def _stub_response(request: TriageRequest) -> AuraResponse:
    """Deterministic stub for offline smoke tests (USE_AI_STUB=1)."""
    text = request.transcript.lower()
    if "drooping" in text or "slurred" in text:
        return AuraResponse(
            action_type="emergency_escalation",
            detected_mode="emergency",
            detected_condition_id="stroke_tia",
            extracted_dashboard_metrics={},
            ai_spoken_response=(
                "These symptoms can be a medical emergency. "
                "Please seek emergency care immediately."
            ),
            trigger_exa_search=None,
            pending_triage_update=None,
        )
    if request.pendingTriage and (
        "no arm" in text or "after a big meal" in text or "no," in text
    ):
        return AuraResponse(
            action_type="resolve",
            detected_mode="preventive",
            detected_condition_id="acid_reflux_gerd",
            extracted_dashboard_metrics={},
            ai_spoken_response=(
                "Glad the concerning chest signs are absent. "
                "This may fit reflux after a large meal - consider antacids and upright rest."
            ),
            trigger_exa_search=None,
            pending_triage_update=None,
        )
    if "chest" in text or "heart racing" in text or "nauseous" in text:
        return AuraResponse(
            action_type="ask_follow_up",
            detected_mode="emergency",
            detected_condition_id=None,
            extracted_dashboard_metrics={},
            ai_spoken_response=(
                "Is the pain radiating to your left arm or jaw, "
                "and are you short of breath or sweaty?"
            ),
            trigger_exa_search=None,
            pending_triage_update=PendingTriage(
                condition_id="acute_myocardial_infarction",
                turn=1,
            ),
        )
    return AuraResponse(
        action_type="general_response",
        detected_mode="preventive",
        detected_condition_id=None,
        extracted_dashboard_metrics={},
        ai_spoken_response="Sounds good — I'm here if you want to log how you feel later.",
        trigger_exa_search=None,
        pending_triage_update=None,
    )


def _call_gemini(system: str, user: str, *, repair: bool = False) -> AuraLLMSchema:
    client = _client()
    contents = user
    if repair:
        contents = (
            user
            + "\n\nIMPORTANT: Your previous reply was invalid. "
            "Return valid JSON only that matches the required schema exactly."
        )

    response = client.models.generate_content(
        model=_model_name(),
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.0,
            response_mime_type="application/json",
            response_json_schema=AuraLLMSchema.model_json_schema(),
        ),
    )

    if response.parsed is not None:
        if isinstance(response.parsed, AuraLLMSchema):
            return response.parsed
        return AuraLLMSchema.model_validate(response.parsed)

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return AuraLLMSchema.model_validate_json(text)


def run_triage(request: TriageRequest) -> AuraResponse:
    """Build prompts → call Gemini (or stub) → validate → sanitize metrics."""
    if _use_stub():
        return _sanitize_aura(_stub_response(request))

    messages = build_messages(request)
    try:
        parsed = _call_gemini(messages["system"], messages["user"], repair=False)
        return _sanitize_aura(_to_aura_response(parsed))
    except (ValidationError, json.JSONDecodeError, ValueError, RuntimeError):
        # One repair retry; if that fails, raise so NestJS fallback can take over.
        parsed = _call_gemini(messages["system"], messages["user"], repair=True)
        return _sanitize_aura(_to_aura_response(parsed))
