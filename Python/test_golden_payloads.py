"""Run the 4 golden triage payloads against live Gemini (or stub).

Usage:
  python test_golden_payloads.py
"""

from __future__ import annotations

import json
from pathlib import Path

from models import TriageRequest
from llm import run_triage

PAYLOAD_DIR = Path(__file__).resolve().parent / "tests" / "sample_payloads"

EXPECTATIONS = {
    "01_overlap.json": {
        "action_type": "ask_follow_up",
        "detected_mode": "emergency",
    },
    "02_followup_no.json": {
        "action_type": "resolve",
        "detected_mode": "preventive",
    },
    "03_bypass.json": {
        "action_type": "emergency_escalation",
        "detected_mode": "emergency",
    },
    "04_general.json": {
        "action_type": "general_response",
        "detected_mode": "preventive",
    },
}


def main() -> None:
    failures: list[str] = []

    for name, expected in EXPECTATIONS.items():
        path = PAYLOAD_DIR / name
        raw = json.loads(path.read_text(encoding="utf-8"))
        request = TriageRequest.model_validate(raw)
        print(f"\n=== {name} ===")
        print(f"transcript: {request.transcript!r}")

        result = run_triage(request)
        print(result.model_dump_json(indent=2))

        if result.action_type != expected["action_type"]:
            failures.append(
                f"{name}: action_type={result.action_type!r} "
                f"expected {expected['action_type']!r}"
            )
        if result.detected_mode != expected["detected_mode"]:
            failures.append(
                f"{name}: detected_mode={result.detected_mode!r} "
                f"expected {expected['detected_mode']!r}"
            )
        if "clinical_alert" in (result.detected_mode, result.action_type):
            failures.append(f"{name}: forbidden clinical_alert value")

        if result.action_type == "ask_follow_up":
            if result.pending_triage_update is None:
                failures.append(f"{name}: pending_triage_update missing on ask_follow_up")
        else:
            if result.pending_triage_update is not None:
                failures.append(
                    f"{name}: pending_triage_update should be null on terminal action"
                )

        bad_keys = set(result.extracted_dashboard_metrics) - {"pain_level", "sleep_hours"}
        if bad_keys:
            failures.append(f"{name}: illegal metric keys {bad_keys}")

        if not isinstance(result.reasoning_trace, list):
            failures.append(f"{name}: reasoning_trace must be a list")
        elif len(result.reasoning_trace) < 1 or len(result.reasoning_trace) > 3:
            failures.append(
                f"{name}: reasoning_trace length={len(result.reasoning_trace)} "
                "expected 1-3 bullets"
            )
        elif request.transcript.lower() in " ".join(result.reasoning_trace).lower():
            failures.append(f"{name}: reasoning_trace must not quote transcript verbatim")

    print("\n=== SUMMARY ===")
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        raise SystemExit(1)
    print("All 4 golden payloads passed.")


if __name__ == "__main__":
    main()
