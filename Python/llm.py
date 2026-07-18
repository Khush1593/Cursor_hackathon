"""Gemini LLM client for Aura triage (structured JSON → AuraResponse)."""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import List, Literal, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from config import gemini_api_key, llm_timeout_seconds, model_name, use_ai_stub
from models import AuraResponse, PendingTriage, TriageRequest
from prompt import build_messages

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
    reasoning_trace: List[str] = Field(default_factory=list)


def _use_stub() -> bool:
    return use_ai_stub()


def _client() -> genai.Client:
    api_key = gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment / .env")
    timeout_ms = int(llm_timeout_seconds() * 1000)
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=timeout_ms),
    )


def _model_name() -> str:
    return model_name()


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
        reasoning_trace=list(parsed.reasoning_trace or []),
    )


def _sanitize_spoken(text: str) -> str:
    """Keep ai_spoken_response TTS-friendly for NestJS → ElevenLabs.

    Python never calls ElevenLabs; NestJS sends this string to TTS.
    Strip markdown so the voice layer gets plain speech.
    """
    cleaned = text.replace("```", " ")
    # Strip markdown markers but keep underscores (condition_id uses them).
    cleaned = re.sub(r"[*`#]+", "", cleaned)
    cleaned = re.sub(r"(?<!\w)\*+(?!\w)", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _restore_condition_ids(line: str) -> str:
    """Repair condition_ids if the model stripped underscores."""
    from prompt import load_triage_dataset

    out = line
    ids = sorted(
        (c["condition_id"] for c in load_triage_dataset()),
        key=len,
        reverse=True,
    )
    for cid in ids:
        compact = cid.replace("_", "")
        if not compact:
            continue
        if re.search(re.escape(compact), out, flags=re.IGNORECASE) and cid not in out:
            out = re.sub(re.escape(compact), cid, out, flags=re.IGNORECASE)
    return out


def _sanitize_reasoning_trace(trace: list[str], transcript: str) -> list[str]:
    """Keep 1-3 non-PHI explainability bullets (no verbatim transcript quotes)."""
    transcript_l = (transcript or "").strip().lower()
    cleaned: list[str] = []
    for item in trace:
        line = _restore_condition_ids(_sanitize_spoken(str(item)))
        if not line:
            continue
        # Drop lines that paste the user's raw utterance (PHI / privacy rule).
        if transcript_l and len(transcript_l) >= 8 and transcript_l in line.lower():
            continue
        cleaned.append(line)
        if len(cleaned) >= 3:
            break
    return cleaned


def _sanitize_aura(response: AuraResponse, transcript: str = "") -> AuraResponse:
    """Drop illegal metric keys, normalize spoken text, sanitize reasoning_trace."""
    cleaned_metrics = {
        k: v
        for k, v in response.extracted_dashboard_metrics.items()
        if k in ALLOWED_METRIC_KEYS
    }
    spoken = _sanitize_spoken(response.ai_spoken_response)
    trace = _sanitize_reasoning_trace(response.reasoning_trace, transcript)
    return response.model_copy(
        update={
            "extracted_dashboard_metrics": cleaned_metrics,
            "ai_spoken_response": spoken,
            "reasoning_trace": trace,
        }
    )


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
            reasoning_trace=[
                "Matched: stroke_tia (severity 10)",
                "Emergency bypass: empty secondary_symptoms_to_check",
            ],
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
            reasoning_trace=[
                "Ruled out: acute_myocardial_infarction (no radiating arm pain)",
                "Resolved: acid_reflux_gerd (post-meal pattern)",
            ],
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
            reasoning_trace=[
                "Overlap: chest tightness + heart racing + nausea",
                "Checking secondary: radiating arm/jaw pain or crushing pressure",
            ],
        )
    return AuraResponse(
        action_type="general_response",
        detected_mode="preventive",
        detected_condition_id=None,
        extracted_dashboard_metrics={},
        ai_spoken_response="Sounds good - I'm here if you want to log how you feel later.",
        trigger_exa_search=None,
        pending_triage_update=None,
        reasoning_trace=["No clinical triggers matched; general acknowledgment"],
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

    def _invoke() -> AuraLLMSchema:
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

    timeout = llm_timeout_seconds()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_invoke)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeout as exc:
            raise RuntimeError(
                f"Gemini call timed out after {timeout:.0f}s"
            ) from exc


def run_triage(request: TriageRequest) -> AuraResponse:
    """Build prompts → call Gemini (or stub) → validate → sanitize metrics."""
    if _use_stub():
        return _sanitize_aura(_stub_response(request), request.transcript)

    messages = build_messages(request)
    try:
        parsed = _call_gemini(messages["system"], messages["user"], repair=False)
        return _sanitize_aura(_to_aura_response(parsed), request.transcript)
    except (ValidationError, json.JSONDecodeError, ValueError, RuntimeError):
        # One repair retry; if that fails, raise so NestJS fallback can take over.
        parsed = _call_gemini(messages["system"], messages["user"], repair=True)
        return _sanitize_aura(_to_aura_response(parsed), request.transcript)
