"""Health-scope guardrails for Aura triage.

Refuse general knowledge / off-topic info requests and redirect the user
to health-related check-ins only. Mid-triage turns are never blocked.
"""

from __future__ import annotations

import re

from models import AuraResponse, TriageRequest

# Signals the utterance is about body/symptoms/care (allow through to triage).
_HEALTH_CUES = (
    "pain",
    "hurt",
    "ache",
    "sore",
    "leg",
    "calf",
    "symptom",
    "sick",
    "ill",
    "fever",
    "cough",
    "nausea",
    "nauseous",
    "vomit",
    "dizzy",
    "vertigo",
    "chest",
    "heart",
    "breath",
    "breathing",
    "headache",
    "migraine",
    "sleep",
    "slept",
    "tired",
    "fatigue",
    "blood",
    "pressure",
    "sugar",
    "diabetes",
    "asthma",
    "wheeze",
    "rash",
    "swelling",
    "numb",
    "droop",
    "slurr",
    "stroke",
    "arm",
    "jaw",
    "stomach",
    "abdomen",
    "urine",
    "diarrhea",
    "medicine",
    "medication",
    "meds",
    "doctor",
    "hospital",
    "er ",
    "emergency",
    "feel",
    "feeling",
    "symptom",
    "triage",
    "wellness",
    "health",
    "vitals",
    "bp ",
    "pulse",
)

# Signals a general-info / off-domain request (block).
_OFFTOPIC_CUES = (
    "capital of",
    "who is the",
    "who was",
    "who invented",
    "who won",
    "tell me a joke",
    "write a poem",
    "write code",
    "write a story",
    "solve this math",
    "what is 2+",
    "weather in",
    "weather today",
    "stock price",
    "bitcoin",
    "cryptocurrency",
    "recipe for",
    "how to cook",
    "movie recommend",
    "best restaurant",
    "translate this",
    "in python",
    "in javascript",
    "homework",
    "essay about",
    "latest news",
    "who is president",
    "sports score",
    "cricket score",
    "football score",
)

_REFUSAL_SPOKEN = (
    "I can only help with your health check-ins and symptoms - "
    "I can't answer general questions. "
    "Please tell me how you're feeling, any pain, sleep, or other health concerns."
)


def _has_health_cue(text: str) -> bool:
    return any(cue in text for cue in _HEALTH_CUES)


def _has_offtopic_cue(text: str) -> bool:
    return any(cue in text for cue in _OFFTOPIC_CUES)


def is_non_health_info_request(request: TriageRequest) -> bool:
    """True when the user is asking off-topic information (not a health turn)."""
    # Never interrupt an active differential cross-examination.
    if request.pendingTriage is not None:
        return False

    text = (request.transcript or "").strip().lower()
    if not text:
        return False

    if _has_health_cue(text):
        return False

    if _has_offtopic_cue(text):
        return True

    # Question-shaped, no health cues → treat as out-of-scope info request.
    if "?" in text or re.match(
        r"^(what|who|where|when|why|how|tell me|explain|define)\b",
        text,
    ):
        return True

    return False


def health_scope_refusal_response() -> AuraResponse:
    """Frozen Nest-compatible refusal (general_response / preventive)."""
    return AuraResponse(
        action_type="general_response",
        detected_mode="preventive",
        detected_condition_id=None,
        extracted_dashboard_metrics={},
        ai_spoken_response=_REFUSAL_SPOKEN,
        trigger_exa_search=None,
        pending_triage_update=None,
        reasoning_trace=[
            "Out-of-scope: non-health information request",
            "Refused — redirect to health-related check-in only",
        ],
    )
