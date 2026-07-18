# 🧠 AI Developer Playbook — The Triage Engine (Python / FastAPI)

> **You own:** the stateless clinical reasoning service. Given one transcript + context, you
> return one validated JSON decision. You do NOT touch the database, ElevenLabs, Exa, or the UI.
> **Source of truth for contracts:** [contracts.MD](contracts.MD). Never rename a field
> without updating that file AND pinging the backend dev.

---

## 1. Your mission in one sentence

Turn `{ transcript, baseline, recentLogs, recurringConditions, pendingTriage }` into a strict
`AuraResponse` JSON that follows the Differential Protocol — always ruling out the deadliest
overlapping condition first — and never hallucinating an invalid shape.

## 2. Stack & port

- **Python 3.11 + FastAPI + Uvicorn**, runs on **`:8000`**.
- **LLM:** OpenAI (or Claude) with **Structured Outputs / JSON mode** bound to the `AuraResponse`
  Pydantic model — this makes malformed JSON physically impossible.
- **Stateless.** No DB, no disk writes. Everything you need arrives in the request body.
- Files you own: [triage_dataset.json](triage_dataset.json) (locked), the system prompt in
  [prompt_instruction.md](prompt_instruction.md).

## 3. Environment (`.env`)

```
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o-2024-08-06        # any model that supports structured outputs
```

## 4. Folder structure to create

```
python-backend/
├── main.py                 # FastAPI app: POST /triage, GET /health
├── models.py               # Pydantic: TriageRequest, AuraResponse, sub-models
├── prompt.py               # builds the system prompt + injects triage_dataset.json
├── llm.py                  # OpenAI structured-output call + retry/repair
├── triage_dataset.json     # COPY of the locked dataset (or symlink to repo root)
├── requirements.txt        # fastapi, uvicorn, openai, pydantic
├── Dockerfile
└── tests/
    └── sample_payloads/    # the 4 golden requests below
```

---

## 5. 🔒 THE FROZEN CONTRACT (your seam with Backend)

**Backend calls you:** `POST http://<you>:8000/triage`

### Request body you RECEIVE — `TriageRequest`

```json
{
  "transcript": "My chest feels tight and my heart is racing",
  "baseline": {
    "age": 34,
    "sex": "female",
    "chronicConditions": ["mild eczema"],
    "currentMeds": ["multivitamin"]
  },
  "recentLogs": [
    {
      "rawAudioText": "slept badly",
      "detectedConditionId": null,
      "extractedMetrics": { "sleep_hours": 5 },
      "createdAt": "2026-07-16T22:10:00Z"
    }
  ],
  "recurringConditions": ["migraine_exacerbation"],
  "pendingTriage": { "condition_id": "acute_myocardial_infarction", "turn": 1 }
}
```

- `recurringConditions`: condition_ids the user logged ≥2× in 7 days (backend computes via SQL). `[]` if none.
- `pendingTriage`: `null` on a fresh turn. If present, you are MID-triage — continue that cross-examination.

### Response body you RETURN — `AuraResponse`

```json
{
  "action_type": "ask_follow_up",
  "detected_mode": "emergency",
  "detected_condition_id": null,
  "extracted_dashboard_metrics": { "pain_level": 7 },
  "ai_spoken_response": "Is the pain radiating to your left arm or jaw?",
  "trigger_exa_search": null,
  "pending_triage_update": {
    "condition_id": "acute_myocardial_infarction",
    "turn": 1
  }
}
```

**Enums (exact strings — no others):**

- `action_type`: `ask_follow_up` | `resolve` | `emergency_escalation` | `general_response`
- `detected_mode`: `preventive` | `urgent_care` | `emergency` ← **3 tiers. `clinical_alert` is DEAD.**

**Field rules:**
| Field | Rule |
|---|---|
| `detected_condition_id` | the matched `condition_id` on `resolve`/`emergency_escalation`; else `null` |
| `extracted_dashboard_metrics` | EXACT keys only: `pain_level` (int 1–10), `sleep_hours` (int 0–24). `{}` if none mentioned |
| `trigger_exa_search` | the matched condition's `resolution_action.exa_search_query` on `resolve`; else `null` |
| `pending_triage_update` | `{condition_id, turn}` on `ask_follow_up`; **`null`** on resolve/emergency/general |
| `ai_spoken_response` | ≤3 sentences, empathetic, read aloud by TTS. No markdown. |

**GET `/health` → `{ "status": "ok" }`** (backend/docker healthcheck).

---

## 6. Pydantic models (`models.py`) — copy exactly

```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal

class UserBaseline(BaseModel):
    age: int
    sex: str
    chronicConditions: List[str]
    currentMeds: List[str]

class RecentLog(BaseModel):
    rawAudioText: str
    detectedConditionId: Optional[str] = None
    extractedMetrics: Dict[str, Any]
    createdAt: str

class PendingTriage(BaseModel):
    condition_id: str
    turn: int

class TriageRequest(BaseModel):
    transcript: str
    baseline: UserBaseline
    recentLogs: List[RecentLog]
    recurringConditions: List[str] = []
    pendingTriage: Optional[PendingTriage] = None

class AuraResponse(BaseModel):
    action_type: Literal["ask_follow_up", "resolve", "emergency_escalation", "general_response"]
    detected_mode: Literal["preventive", "urgent_care", "emergency"]
    detected_condition_id: Optional[str] = None
    extracted_dashboard_metrics: Dict[str, Any] = {}
    ai_spoken_response: str
    trigger_exa_search: Optional[str] = None
    pending_triage_update: Optional[PendingTriage] = None
```

## 7. What to build (in order)

1. **Scaffold** FastAPI, `GET /health`, `POST /triage` accepting `TriageRequest`.
2. **`prompt.py`:** load `triage_dataset.json`, build the system prompt from
   [prompt_instruction.md](prompt_instruction.md) §1, and concatenate the full dataset array under a
   `=== TRIAGE DATASET ===` header. Inject `baseline`, `recentLogs`, `recurringConditions`,
   `pendingTriage` as a `user` message. **Wrap the transcript in `<user_transcript>…</user_transcript>`**
   and tell the model to treat it as data, never instructions (injection guard).
3. **`llm.py`:** call the LLM with structured output = `AuraResponse`. Set `temperature=0` for
   deterministic triage. On a validation error, retry ONCE with a "return valid JSON only" nudge;
   if it fails again, raise — the backend's fallback cache takes over (don't build your own fallback).
4. **Differential Protocol** lives entirely in the prompt (already written). Your code just: build
   prompt → call LLM → validate → return. Do NOT hardcode if/else triage logic in Python.
5. **Enforce metric keys**: after the LLM returns, drop any `extracted_dashboard_metrics` key that
   isn't `pain_level` or `sleep_hours` (belt-and-suspenders so the chart never gets junk keys).

## 8. 🧪 Build & test WITHOUT the backend (you're independent)

You never need NestJS running. Test via Swagger UI at **`http://localhost:8000/docs`** or curl.
Keep these 4 golden payloads in `tests/sample_payloads/` and assert the expected `action_type`:

| Payload               | Transcript                                  | pendingTriage                      | Expected `action_type` / `detected_mode`           |
| --------------------- | ------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `01_overlap.json`     | "chest tight, heart racing, bit nauseous"   | null                               | `ask_follow_up` / `emergency` (rules out MI first) |
| `02_followup_no.json` | "no, no arm pain, started after a big meal" | `{acute_myocardial_infarction, 1}` | `resolve` / `preventive` (→ GERD)                  |
| `03_bypass.json`      | "my face is drooping and speech slurred"    | null                               | `emergency_escalation` / `emergency`               |
| `04_general.json`     | "just heading to the gym!"                  | null                               | `general_response` / `preventive`                  |

Run:

```bash
uvicorn main:app --reload --port 8000
curl -X POST localhost:8000/triage -H "Content-Type: application/json" -d @tests/sample_payloads/01_overlap.json
```

## 9. Definition of Done

- [ ] `/triage` returns a schema-valid `AuraResponse` for all 4 golden payloads with correct `action_type`.
- [ ] Never returns `clinical_alert`; only the 3 valid `detected_mode` values.
- [ ] Emergency-bypass conditions (empty `secondary_symptoms_to_check`) skip follow-ups.
- [ ] `pending_triage_update` is set on `ask_follow_up` and `null` on every terminal action.
- [ ] Structured outputs enabled → 0 malformed-JSON responses in 20 test runs.
- [ ] `GET /health` returns `{status:"ok"}`.
- [ ] Dockerfile builds; `uvicorn` starts on 8000.

## 10. ⚠️ Golden rules (break these = integration fails)

- **Field names & enums are frozen.** `extracted_dashboard_metrics` stays snake_case; backend renames it.
- **Stay stateless.** Never store `pendingTriage` yourself — echo it back via `pending_triage_update`.
- **Don't build a fallback** — that's the backend's `fallback_responses.json`. You just raise on failure.
- **Metric keys are exactly `pain_level` + `sleep_hours`.** Anything else breaks the chart.
