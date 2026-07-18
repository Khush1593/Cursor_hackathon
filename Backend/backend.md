# ⚙️ Backend Developer Playbook — The Gateway & Data Controller (NestJS)

> **You own:** the traffic controller, database, and every fail-safe. You sit between the frontend
> and the AI. You expose clean REST to the frontend, call the AI service, add voice (ElevenLabs)
> and research (Exa), persist everything, and NEVER let a downstream failure reach the UI.
> **Source of truth for contracts:** [contracts_v5.md](contracts_v5.md).

---

## 1. Your mission in one sentence
Receive `{userId, transcript}`, assemble the AI's context from Postgres, call the AI, transform its
answer into the frontend shape (+ audio, + Exa card), persist a `HealthLog`, and guarantee a valid
payload every time — falling back to [fallback_responses.json](fallback_responses.json) on any error.

## 2. Stack & port
- **NestJS + Prisma + PostgreSQL**, runs on **`:3000`**.
- Talks to: **AI service** (`:8000`), **ElevenLabs**, **Exa**. Serves the **Next.js frontend** (`:3001` / Vercel).
- Validates every AI response with **Zod** before trusting it.

## 3. Environment (`.env`)
```
DATABASE_URL=postgresql://aura_user:aura_password@localhost:5432/aura_db
PYTHON_SERVICE_URL=http://localhost:8000     # http://python_ai:8000 in docker
EXA_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...                       # pick one calm voice, hardcode it
FRONTEND_ORIGIN=http://localhost:3001         # the Vercel URL in prod
USE_AI_STUB=false                             # true = skip Python, return canned AuraResponse
```

## 4. Folder structure to create
```
nestjs-backend/
├── prisma/schema.prisma            # full schema below
├── prisma/seed.ts                  # demo user + 4 days of history (Hour 11)
├── src/
│   ├── main.ts                     # CORS config in Hour 1
│   ├── users/                      # GET dashboard, PATCH reset-emergency
│   ├── triage/                     # POST /api/triage/turn — the orchestrator
│   ├── integrations/
│   │   ├── ai.client.ts            # POST -> PYTHON_SERVICE_URL/triage (+ stub)
│   │   ├── elevenlabs.client.ts    # text -> base64 mp3
│   │   └── exa.client.ts           # query -> {title,url,summary} | null
│   ├── validation/aura.schema.ts   # Zod AuraResponseSchema
│   └── data/fallback_responses.json# COPY from repo root
└── Dockerfile
```

---

## 5. 🔒 FROZEN CONTRACT A — your seam with FRONTEND (you are the SERVER)

### `GET /api/users/:userId/dashboard` (called on app mount)
```json
{
  "user": { "id": "uuid", "age": 34, "sex": "female",
            "activeMode": "preventive", "isEmergencyState": false,
            "emergencyContactName": "Jane Doe", "emergencyContactPhone": "+1-555-0100" },
  "metricsHistory": [ { "date": "2026-07-13", "pain_level": 5, "sleep_hours": 6 } ],
  "recentMessages": [ { "role": "user", "text": "I slept badly", "createdAt": "2026-07-16T22:10:00Z" } ]
}
```

### `POST /api/triage/turn`  — request in, response out
```json
// REQUEST from frontend
{ "userId": "uuid-string", "transcript": "My chest hurts" }

// RESPONSE you return (matches fallback_responses.json 1:1)
{
  "action_type": "ask_follow_up",
  "detected_mode": "urgent_care",
  "ai_spoken_response": "Are you experiencing any crushing chest pressure?",
  "audio_base64": "UklGRiQ...",              // null on fallback / TTS failure
  "is_emergency_state": false,
  "updated_metrics": { "pain_level": 4, "sleep_hours": null },
  "exa_insight": null                         // {title,url,summary} only on action_type "resolve"
}
```

### `PATCH /api/users/reset-emergency`
```json
// REQUEST { "userId": "uuid-string" }
// RESPONSE { "is_emergency_state": false, "active_mode": "preventive" }
```

## 6. 🔒 FROZEN CONTRACT B — your seam with AI (you are the CLIENT)

`POST {PYTHON_SERVICE_URL}/triage` — send `TriageRequest`, receive `AuraResponse`.
**Full shapes are in [ai.md](ai.md) §5.** The key transforms YOU perform on the AI's response:

| AI field (`AuraResponse`) | Becomes (frontend) | How |
|---|---|---|
| `extracted_dashboard_metrics` | `updated_metrics` | rename |
| `action_type === "emergency_escalation"` | `is_emergency_state: true` | derive |
| `ai_spoken_response` | `audio_base64` | send to ElevenLabs → base64 |
| `trigger_exa_search` (if not null) | `exa_insight` | call Exa → `{title,url,summary}` |
| `detected_condition_id`, `pending_triage_update` | — | consumed server-side, NOT forwarded |

---

## 7. Prisma schema (`schema.prisma`)
```prisma
model User {
  id                    String      @id @default(uuid())
  age                   Int
  sex                   String
  chronicConditions     String[]
  currentMeds           String[]
  emergencyContactName  String?
  emergencyContactPhone String?
  activeMode            String      @default("preventive") // preventive | urgent_care | emergency
  isEmergencyState      Boolean     @default(false)
  pendingTriage         Json?       // { "condition_id": "...", "turn": 1 }
  healthLogs            HealthLog[]
  exaInsights           ExaInsight[]
}

model HealthLog {
  id                  String   @id @default(uuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  createdAt           DateTime @default(now())
  rawAudioText        String
  detectedMode        String   // preventive | urgent_care | emergency
  detectedConditionId String?  // set on resolve/emergency; powers trend SQL
  severityScore       Int?     // mapped from triage_dataset severity_rank; null on ask_follow_up
  extractedMetrics    Json     // { "pain_level": 4, "sleep_hours": 6 }
  aiResponseText      String
}

model ExaInsight {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  createdAt      DateTime @default(now())
  triggerSymptom String
  articleTitle   String
  articleUrl     String
  aiSummary      String
}
```

## 8. The `/api/triage/turn` orchestration (exact step order)
1. Load `User` by `userId` (baseline, `pendingTriage`, current state).
2. Query last-7-days `HealthLog` → `recentLogs`. Run the trend SQL ([contracts_v5.md](contracts_v5.md) §4)
   → `recurringConditions: string[]`.
3. Build `TriageRequest` and `POST` to the AI service (or return the stub if `USE_AI_STUB=true`).
4. **Validate the AI response with Zod.** If it throws → jump to step 9 (fallback).
5. If `trigger_exa_search` is set → call Exa (§9) → build `exa_insight`; also write an `ExaInsight` row.
6. Send `ai_spoken_response` to ElevenLabs → `audio_base64`. If TTS fails, set `audio_base64: null` (don't crash).
7. **Persist per the HealthLog rules** (table below). Update `User.pendingTriage`. On emergency set
   `isEmergencyState=true`, `activeMode="emergency"`.
8. Transform → return the frontend response shape (§5). **Done.**
9. **Fallback:** on any thrown error, pick `emergency_fallback` vs `safe_mode_fallback` by keyword
   (hard combinations only — see [prompt_instruction.md](prompt_instruction.md) §2) and return it verbatim.

### HealthLog write rules
| `action_type` | Write log? | `detectedConditionId` | `severityScore` | `pendingTriage` |
|---|---|---|---|---|
| `ask_follow_up` | yes | null | null | **set** to `pending_triage_update` |
| `resolve` | yes | condition_id | look up `severity_rank` in `triage_dataset.json` | **null** |
| `emergency_escalation` | yes | condition_id (if any) | `severity_rank` | **null** + set emergency state |
| `general_response` | **NO — skip entirely** | — | — | **null** |

> Load `triage_dataset.json` once at boot into a `Map<condition_id, severity_rank>` for the lookup in step 7.

## 9. Exa call (guard for zero results!)
```typescript
const r = await fetch('https://api.exa.ai/search', {
  method: 'POST',
  headers: { 'x-api-key': process.env.EXA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, numResults: 1,
    contents: { text: false, highlights: { highlightsPerUrl: 1, numSentences: 2 } } }),
});
const j = await r.json();
const exa_insight = j.results?.length
  ? { title: j.results[0].title, url: j.results[0].url,
      summary: j.results[0].highlights?.[0] ?? "No summary available." }
  : null;
```

## 10. 🧪 Build & test WITHOUT frontend or AI (you're independent)
- **AI not ready?** Set `USE_AI_STUB=true`. `ai.client.ts` returns a canned `AuraResponse`
  (rotate a few by keyword so you can exercise every branch). Swap to the real Python later by flipping the flag.
- **Frontend not ready?** Test your endpoints with curl:
```bash
curl -X POST localhost:3000/api/triage/turn -H "Content-Type: application/json" \
  -d '{"userId":"<seeded-id>","transcript":"my chest feels tight"}'
curl localhost:3000/api/users/<seeded-id>/dashboard
curl -X PATCH localhost:3000/api/users/reset-emergency -H "Content-Type: application/json" \
  -d '{"userId":"<seeded-id>"}'
```
- **CORS (Hour 1):** in `main.ts`, `app.enableCors({ origin: process.env.FRONTEND_ORIGIN, methods: ['GET','POST','PATCH'] })`.

## 11. Seed script (Hour 11) — must make the demo trends fire
Create the demo user with **benign baseline** (`chronicConditions:["mild eczema"]`,
`currentMeds:["multivitamin"]`) + emergency contacts, and **4 days of `HealthLog`** where each
`extractedMetrics` has `{pain_level, sleep_hours}` and a **repeating `detectedConditionId`**
(e.g. `migraine_exacerbation` ×3) so both the Recharts graph and `recurringConditions` light up.
The user's `id` must equal the frontend's `NEXT_PUBLIC_DEMO_USER_ID`.

## 12. Definition of Done
- [ ] All 3 frontend endpoints return the exact frozen shapes (verified by curl).
- [ ] Zod rejects a bad AI response and the fallback fires instead of a 500.
- [ ] `general_response` writes NO log; `resolve` writes a log with condition_id + severity_rank.
- [ ] Emergency turn sets `isEmergencyState=true`; reset endpoint clears it.
- [ ] Exa zero-result returns `exa_insight: null` (no crash); TTS failure returns `audio_base64: null`.
- [ ] Seed produces a chartable 4-day history + a repeating condition.
- [ ] CORS allows the frontend origin.

## 13. ⚠️ Golden rules
- **You are the ONLY translator.** Frontend never sees AI field names; AI never sees frontend field names.
- **Never return a raw error to the frontend** — always a valid response or a fallback object.
- **Field names frozen** across both seams. Change one → update [contracts_v5.md](contracts_v5.md) + tell the other two devs.
