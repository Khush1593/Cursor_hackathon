"""Smoke-test prompt construction (no LLM call).

Run: python test_prompt_step3.py
"""

from models import RecentLog, TriageRequest, UserBaseline
from prompt import build_messages, load_triage_dataset


def main() -> None:
    dataset = load_triage_dataset()
    assert len(dataset) == 24, f"expected 24 conditions, got {len(dataset)}"
    assert "condition_id" in dataset[0]

    request = TriageRequest(
        transcript="My chest feels tight and my heart is racing",
        baseline=UserBaseline(
            age=34,
            sex="female",
            chronicConditions=["mild eczema"],
            currentMeds=["multivitamin"],
        ),
        recentLogs=[
            RecentLog(
                rawAudioText="slept badly",
                detectedConditionId=None,
                extractedMetrics={"sleep_hours": 5},
                createdAt="2026-07-16T22:10:00Z",
            )
        ],
        recurringConditions=["migraine_exacerbation"],
        pendingTriage=None,
    )

    messages = build_messages(request)
    system = messages["system"]
    user = messages["user"]

    assert "=== TRIAGE DATASET ===" in system
    assert "acute_myocardial_infarction" in system
    assert "Differential Protocol".upper() in system.upper() or "DIFFERENTIAL PROTOCOL" in system
    assert "<user_transcript>" in user
    assert "</user_transcript>" in user
    assert "My chest feels tight" in user
    assert "mild eczema" in user

    print("Step 3 OK")
    print(f"  dataset conditions: {len(dataset)}")
    print(f"  system prompt chars: {len(system)}")
    print(f"  user message chars:  {len(user)}")
    print("  transcript delimiters: present")


if __name__ == "__main__":
    main()
