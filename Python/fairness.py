"""Non-PHI demographic fairness counters (hackathon / ethics demo).

Records ONLY aggregated buckets:
  - age_band (e.g. 40-49)
  - sex_group (female | male | other | unknown)
  - action_type / detected_mode

Never stores user IDs, names, transcripts, or condition narrative text.
In-memory only — resets on process restart. Nest/DB should own durable storage.
"""

from __future__ import annotations

import logging
import threading
from collections import defaultdict
from typing import Any

from models import AuraResponse, TriageRequest

logger = logging.getLogger("aura.python.fairness")

_lock = threading.Lock()
# key: (age_band, sex_group, action_type, detected_mode) -> count
_counts: dict[tuple[str, str, str, str], int] = defaultdict(int)
_total = 0


def age_band(age: int) -> str:
    if age < 0:
        return "unknown"
    if age < 18:
        return "0-17"
    if age < 30:
        return "18-29"
    if age < 40:
        return "30-39"
    if age < 50:
        return "40-49"
    if age < 60:
        return "50-59"
    if age < 70:
        return "60-69"
    return "70+"


def sex_group(sex: str) -> str:
    s = (sex or "").strip().lower()
    if s.startswith("f"):
        return "female"
    if s.startswith("m"):
        return "male"
    if not s:
        return "unknown"
    return "other"


def record_triage_outcome(request: TriageRequest, response: AuraResponse) -> None:
    """Log one non-PHI fairness event after a successful triage."""
    global _total
    band = age_band(request.baseline.age)
    group = sex_group(request.baseline.sex)
    key = (band, group, response.action_type, response.detected_mode)

    with _lock:
        _counts[key] += 1
        _total += 1

    # Structured log line — safe for log drains; no transcript / user id.
    logger.info(
        "fairness_event age_band=%s sex_group=%s action_type=%s detected_mode=%s",
        band,
        group,
        response.action_type,
        response.detected_mode,
    )


def fairness_snapshot() -> dict[str, Any]:
    """Aggregated counts for GET /fairness/stats (demo / judges)."""
    with _lock:
        rows = [
            {
                "age_band": band,
                "sex_group": group,
                "action_type": action,
                "detected_mode": mode,
                "count": count,
            }
            for (band, group, action, mode), count in sorted(
                _counts.items(), key=lambda kv: (-kv[1], kv[0])
            )
        ]
        total = _total

    emergency_rows = [
        r for r in rows if r["action_type"] == "emergency_escalation"
    ]
    return {
        "total_triage_events": total,
        "note": (
            "Non-PHI aggregates only (age_band + sex_group + outcome). "
            "In-memory; not a clinical fairness audit. Nest should persist long-term."
        ),
        "by_bucket": rows,
        "emergency_escalations_by_bucket": emergency_rows,
    }


def reset_fairness_counters() -> None:
    """Test helper — clears in-memory counters."""
    global _total
    with _lock:
        _counts.clear()
        _total = 0
