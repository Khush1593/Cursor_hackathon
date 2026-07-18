"""Nest ↔ Python contract integration tests (suggestion #9).

These prove the same JSON Nest would POST/receive from POST /triage.
Default: USE_AI_STUB=1 for CI stability (no Gemini flake / rate limits).

Usage:
  python test_nest_integration.py

Optional live LLM (flaky on free tier):
  USE_AI_STUB=0 python test_nest_integration.py
"""

from __future__ import annotations

import os

# Force stub before importing app/llm so CI is deterministic.
os.environ.setdefault("USE_AI_STUB", "1")

from fastapi.testclient import TestClient

from main import app
from models import AuraResponse

client = TestClient(app)

# Exact Nest-shaped body (mirrors Backend AiClient / TriageRequestPayload).
NEST_STROKE_PAYLOAD = {
    "transcript": "my face is drooping and speech slurred",
    "baseline": {
        "age": 58,
        "sex": "male",
        "chronicConditions": ["hypertension"],
        "currentMeds": ["lisinopril"],
    },
    "recentLogs": [],
    "recurringConditions": [],
    "pendingTriage": None,
}

NEST_GENERAL_PAYLOAD = {
    "transcript": "just heading to the gym!",
    "baseline": {
        "age": 28,
        "sex": "female",
        "chronicConditions": [],
        "currentMeds": [],
    },
    "recentLogs": [],
    "recurringConditions": [],
    "pendingTriage": None,
}

NEST_CHEST_OVERLAP = {
    "transcript": "chest tight, heart racing, bit nauseous",
    "baseline": {
        "age": 34,
        "sex": "female",
        "chronicConditions": ["mild eczema"],
        "currentMeds": ["multivitamin"],
    },
    "recentLogs": [
        {
            "rawAudioText": "slept badly",
            "detectedConditionId": None,
            "extractedMetrics": {"sleep_hours": 5},
            "createdAt": "2026-07-16T22:10:00Z",
        }
    ],
    "recurringConditions": [],
    "pendingTriage": None,
}

ALLOWED_ACTIONS = {
    "ask_follow_up",
    "resolve",
    "emergency_escalation",
    "general_response",
}
ALLOWED_MODES = {"preventive", "urgent_care", "emergency"}
ALLOWED_METRICS = {"pain_level", "sleep_hours"}


def _assert_nest_zod_shape(data: dict) -> AuraResponse:
    """Fields Backend aura.schema.ts expects (including reasoning_trace)."""
    for key in (
        "action_type",
        "detected_mode",
        "detected_condition_id",
        "extracted_dashboard_metrics",
        "ai_spoken_response",
        "trigger_exa_search",
        "pending_triage_update",
        "reasoning_trace",
    ):
        assert key in data, f"missing Nest contract field: {key}"

    assert data["action_type"] in ALLOWED_ACTIONS
    assert data["detected_mode"] in ALLOWED_MODES
    assert "clinical_alert" not in (data["action_type"], data["detected_mode"])
    assert isinstance(data["reasoning_trace"], list)
    assert 1 <= len(data["reasoning_trace"]) <= 3
    bad = set(data["extracted_dashboard_metrics"]) - ALLOWED_METRICS
    assert not bad, f"illegal metric keys: {bad}"
    return AuraResponse.model_validate(data)


def test_health_for_nest() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_stroke_always_emergency_escalation() -> None:
    """CI example: face drooping / slurred speech → emergency_escalation."""
    res = client.post("/triage", json=NEST_STROKE_PAYLOAD)
    assert res.status_code == 200, res.text
    body = _assert_nest_zod_shape(res.json())
    assert body.action_type == "emergency_escalation"
    assert body.detected_mode == "emergency"
    assert body.pending_triage_update is None
    assert any(
        "stroke" in line.lower() or "emergency" in line.lower() or "bypass" in line.lower()
        for line in body.reasoning_trace
    )


def test_general_not_emergency() -> None:
    res = client.post("/triage", json=NEST_GENERAL_PAYLOAD)
    assert res.status_code == 200, res.text
    body = _assert_nest_zod_shape(res.json())
    assert body.action_type == "general_response"
    assert body.detected_mode == "preventive"
    assert body.pending_triage_update is None


def test_chest_overlap_asks_or_escalates() -> None:
    res = client.post("/triage", json=NEST_CHEST_OVERLAP)
    assert res.status_code == 200, res.text
    body = _assert_nest_zod_shape(res.json())
    assert body.action_type in {"ask_follow_up", "emergency_escalation"}
    assert body.detected_mode == "emergency"
    if body.action_type == "ask_follow_up":
        assert body.pending_triage_update is not None
    else:
        assert body.pending_triage_update is None


def test_fairness_stats_non_phi() -> None:
    snap = client.get("/fairness/stats").json()
    assert "total_triage_events" in snap
    assert "by_bucket" in snap
    # Ensure no transcript / id keys leaked into buckets.
    for row in snap["by_bucket"]:
        assert set(row.keys()) <= {
            "age_band",
            "sex_group",
            "action_type",
            "detected_mode",
            "count",
        }


def main() -> None:
    test_health_for_nest()
    print("OK  GET /health")
    test_stroke_always_emergency_escalation()
    print("OK  stroke -> emergency_escalation")
    test_general_not_emergency()
    print("OK  gym -> general_response")
    test_chest_overlap_asks_or_escalates()
    print("OK  chest overlap Nest shape")
    test_fairness_stats_non_phi()
    print("OK  /fairness/stats non-PHI")
    print("\nAll Nest-Python integration checks passed (stub mode).")


if __name__ == "__main__":
    main()
