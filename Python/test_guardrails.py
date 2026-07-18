"""Smoke-test health-scope guardrails (no Gemini required).

Usage:
  python test_guardrails.py
"""

from __future__ import annotations

from guardrails import health_scope_refusal_response, is_non_health_info_request
from llm import run_triage
from models import PendingTriage, TriageRequest, UserBaseline


def _req(transcript: str, pending: PendingTriage | None = None) -> TriageRequest:
    return TriageRequest(
        transcript=transcript,
        baseline=UserBaseline(
            age=30,
            sex="female",
            chronicConditions=[],
            currentMeds=[],
        ),
        recentLogs=[],
        pendingTriage=pending,
    )


def main() -> None:
    # Must refuse
    for text in (
        "What is the capital of France?",
        "Tell me a joke",
        "Who won the world cup?",
        "Write code in python for a sorting algorithm",
    ):
        assert is_non_health_info_request(_req(text)), text
        out = run_triage(_req(text))
        assert out.action_type == "general_response", text
        assert out.pending_triage_update is None
        assert "health" in out.ai_spoken_response.lower()
        assert any("out-of-scope" in t.lower() for t in out.reasoning_trace)
        print(f"REFUSE OK: {text!r}")

    # Must allow (health / triage)
    for text in (
        "my chest feels tight",
        "I have a bad headache",
        "face drooping and speech slurred",
    ):
        assert not is_non_health_info_request(_req(text)), text
        print(f"ALLOW OK: {text!r}")

    # Mid-triage answer must never be blocked as off-topic
    pending = PendingTriage(condition_id="acute_myocardial_infarction", turn=1)
    mid = _req("no, no arm pain, started after a big meal", pending=pending)
    assert not is_non_health_info_request(mid)
    print("ALLOW OK: mid-triage follow-up")

    # Casual check-in still general_response path (not hard refuse heuristic)
    gym = _req("just heading to the gym!")
    assert not is_non_health_info_request(gym)
    print("ALLOW OK: casual gym check-in (LLM/stub health-scope ack)")

    refusal = health_scope_refusal_response()
    assert "general questions" in refusal.ai_spoken_response.lower() or "health" in refusal.ai_spoken_response.lower()
    print("\nAll guardrail checks passed.")


if __name__ == "__main__":
    main()
