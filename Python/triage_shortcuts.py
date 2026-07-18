"""Deterministic mid-triage shortcuts + false-escalation corrections.

Stops the LLM from locking emergency when the user clearly DENIES red-flag
secondaries (e.g. leg pain only, no breathing issues after a DVT rule-out ask).
"""

from __future__ import annotations

import re
from typing import Optional

from models import AuraResponse, PendingTriage, TriageRequest
from prompt import load_triage_dataset

_DENIAL_CUES = (
    "no breath",
    "not breath",
    "no shortness",
    "without breath",
    "no chest",
    "not chest",
    "only leg",
    "just leg",
    "leg pain only",
    "only my leg",
    "no arm",
    "not radiating",
    "no radiation",
    "no crushing",
    "no pressure",
    "denied",
    "don't have",
    "do not have",
    "doesn't have",
    "none of those",
    "no to all",
    "nothing like that",
    "nope",
)

_CONFIRM_RED_FLAG_CUES = (
    "can't breathe",
    "cannot breathe",
    "short of breath",
    "shortness of breath",
    "gasping",
    "coughing up blood",
    "cough blood",
    "chest pain when breath",
    "pain when i breathe",
    "radiating to",
    "left arm",
    "jaw pain",
    "crushing",
    "elephant on",
    "face drooping",
    "slurred",
    "lips blue",
    "turning blue",
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def is_explicit_denial(text: str) -> bool:
    t = _norm(text)
    if any(c in t for c in _DENIAL_CUES):
        return True
    # Bare "no" / "no," answers to a yes/no red-flag question
    if re.match(r"^(no|nah|nope)([,.]|\s|$)", t):
        return True
    return False


def is_red_flag_confirmation(text: str) -> bool:
    t = _norm(text)
    return any(c in t for c in _CONFIRM_RED_FLAG_CUES)


def _exa_for(condition_id: str) -> Optional[str]:
    for row in load_triage_dataset():
        if row.get("condition_id") == condition_id:
            action = row.get("resolution_action") or {}
            q = action.get("exa_search_query")
            return q if isinstance(q, str) else None
    return None


def _resolve(
    condition_id: str,
    *,
    mode: str,
    spoken: str,
    reason_lines: list[str],
) -> AuraResponse:
    return AuraResponse(
        action_type="resolve",
        detected_mode=mode,  # type: ignore[arg-type]
        detected_condition_id=condition_id,
        extracted_dashboard_metrics={},
        ai_spoken_response=spoken,
        trigger_exa_search=_exa_for(condition_id),
        pending_triage_update=None,
        reasoning_trace=reason_lines[:3],
    )


def mid_triage_denial_shortcut(request: TriageRequest) -> Optional[AuraResponse]:
    """If mid-triage + clear denial of secondaries → resolve (no emergency lock)."""
    pending = request.pendingTriage
    if pending is None:
        return None

    text = _norm(request.transcript)
    if is_red_flag_confirmation(text):
        return None
    if not is_explicit_denial(text):
        return None

    cid = pending.condition_id

    if cid == "deep_vein_thrombosis":
        return _resolve(
            "deep_vein_thrombosis",
            mode="urgent_care",
            spoken=(
                "Thanks for clarifying — with no sudden breathing trouble or chest pain "
                "when breathing, this does not look like an immediate lung emergency. "
                "Leg pain or swelling still needs prompt medical evaluation; please do not "
                "massage the leg, and get checked soon."
            ),
            reason_lines=[
                "Ruled out PE red flags (no breath/chest secondary symptoms)",
                "Resolved: deep_vein_thrombosis at urgent_care (not emergency lock)",
            ],
        )

    if cid == "acute_myocardial_infarction":
        # Meal / heartburn pattern → GERD; plain denial → still leave to LLM/GERD rules
        if "meal" in text or "food" in text or "heartburn" in text or "after eat" in text:
            return _resolve(
                "acid_reflux_gerd",
                mode="preventive",
                spoken=(
                    "Glad there is no radiating arm or crushing chest warning. "
                    "A post-meal pattern can fit reflux - try staying upright and an antacid, "
                    "and tell me if pain returns with effort or arm symptoms."
                ),
                reason_lines=[
                    "Ruled out: acute_myocardial_infarction (denied cardiac secondaries)",
                    "Resolved: acid_reflux_gerd (post-meal pattern)",
                ],
            )

    if cid in {
        "asthma_exacerbation",
        "pneumonia_lower_respiratory",
        "allergic_rhinitis_vs_anaphylaxis",
        "migraine_exacerbation",
        "viral_upper_respiratory",
        "gastroenteritis",
        "panic_attack",
        "dehydration_heat_exhaustion",
        "hypoglycemia_low_blood_sugar",
        "hypertensive_urgency",
    }:
        # Generic: denial of secondaries → resolve pending condition at its baseline tier
        # but never emergency_escalation purely from denial.
        mode = "urgent_care"
        for row in load_triage_dataset():
            if row.get("condition_id") == cid:
                tm = row.get("target_mode") or "preventive"
                # Do not use emergency mode on denial-resolve (avoids red-lock confusion).
                mode = "urgent_care" if tm == "emergency" else tm
                break
        return _resolve(
            cid,
            mode=mode,
            spoken=(
                "Thank you — since those warning signs are not present, we will treat this "
                "as the lower-urgency pathway. Follow the care advice for this issue and "
                "update me if new red-flag symptoms appear."
            ),
            reason_lines=[
                f"Ruled out secondary red flags for {cid}",
                f"Resolved: {cid} without emergency_escalation",
            ],
        )

    return None


def correct_false_emergency_escalation(
    request: TriageRequest,
    response: AuraResponse,
) -> AuraResponse:
    """If LLM escalates despite clear denial + no red-flag confirm, force resolve."""
    if response.action_type != "emergency_escalation":
        return response
    if request.pendingTriage is None:
        return response

    text = _norm(request.transcript)
    if is_red_flag_confirmation(text):
        return response
    if not is_explicit_denial(text):
        return response

    shortcut = mid_triage_denial_shortcut(request)
    if shortcut is not None:
        return shortcut

    # Fallback: clear pending, resolve pending id at urgent_care
    cid = request.pendingTriage.condition_id
    return _resolve(
        cid,
        mode="urgent_care",
        spoken=(
            "Understood — without those emergency warning signs, I am not locking an "
            "emergency alert. Please seek timely care for your symptoms and tell me if "
            "breathing, chest, or neurological red flags start."
        ),
        reason_lines=[
            "Corrected false emergency_escalation after secondary denial",
            f"Resolved: {cid} at urgent_care",
        ],
    )


def leg_pain_opening_shortcut(request: TriageRequest) -> Optional[AuraResponse]:
    """First-turn leg/calf pain → ask PE rule-out (do not escalate yet)."""
    if request.pendingTriage is not None:
        return None
    t = _norm(request.transcript)
    legish = (
        "leg pain" in t
        or "pain in my leg" in t
        or "pain in the leg" in t
        or "calf" in t
        or "leg swelling" in t
        or "swollen leg" in t
        or "leg cramp" in t
        or ("leg" in t and "pain" in t)
        or ("leg" in t and "swell" in t)
    )
    if not legish:
        return None
    # If they already report PE red flags on first utterance, let LLM escalate.
    if is_red_flag_confirmation(t):
        return None

    return AuraResponse(
        action_type="ask_follow_up",
        detected_mode="urgent_care",
        detected_condition_id=None,
        extracted_dashboard_metrics={},
        ai_spoken_response=(
            "I hear the leg discomfort. To rule out a blood-clot emergency in the lungs, "
            "do you have sudden shortness of breath, chest pain when breathing, or coughing "
            "up blood? If not, say so clearly."
        ),
        trigger_exa_search=None,
        pending_triage_update=PendingTriage(
            condition_id="deep_vein_thrombosis",
            turn=1,
        ),
        reasoning_trace=[
            "Matched: deep_vein_thrombosis pathway (leg/calf symptoms)",
            "Checking secondary: PE red flags before any emergency lock",
        ],
    )
