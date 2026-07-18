"""Tests for leg-pain / denial shortcuts and conversation memory wiring.

Usage:
  USE_AI_STUB=1 python test_leg_pain_flow.py
"""

from __future__ import annotations

import json
from pathlib import Path

from llm import run_triage
from models import TriageRequest
from prompt import build_user_message

PAYLOAD_DIR = Path(__file__).resolve().parent / "tests" / "sample_payloads"


def main() -> None:
    open_req = TriageRequest.model_validate(
        json.loads((PAYLOAD_DIR / "05_leg_pain_open.json").read_text(encoding="utf-8"))
    )
    open_res = run_triage(open_req)
    assert open_res.action_type == "ask_follow_up", open_res
    assert open_res.action_type != "emergency_escalation"
    assert open_res.pending_triage_update is not None
    assert open_res.pending_triage_update.condition_id == "deep_vein_thrombosis"
    assert open_res.detected_mode in {"urgent_care", "emergency"}
    print("OK open leg pain -> ask_follow_up (no emergency lock)")

    deny_req = TriageRequest.model_validate(
        json.loads(
            (PAYLOAD_DIR / "06_leg_pain_deny_breath.json").read_text(encoding="utf-8")
        )
    )
    deny_res = run_triage(deny_req)
    assert deny_res.action_type == "resolve", deny_res
    assert deny_res.action_type != "emergency_escalation"
    assert deny_res.detected_condition_id == "deep_vein_thrombosis"
    assert deny_res.detected_mode == "urgent_care"
    assert deny_res.pending_triage_update is None
    print("OK deny breath -> resolve DVT urgent_care (not emergency)")

    user_msg = build_user_message(deny_req)
    assert "CONVERSATION MEMORY" in user_msg
    assert "I have bad pain in my leg" in user_msg
    assert "ACTIVE pendingTriage" in user_msg
    print("OK conversation memory injected into prompt")

    print("\nAll leg-pain flow checks passed.")


if __name__ == "__main__":
    main()
