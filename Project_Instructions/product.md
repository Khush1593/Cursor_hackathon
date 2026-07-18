Here is the definitive **Aura V5 Blueprint**. This is the final, comprehensive master document incorporating every architectural decision, safety guardrail, team suggestion, and API contract.

You can copy and paste this directly to your team as the single source of truth to start the 24-hour clock.

> **📌 V5 CHANGES (read before building):** The system now uses a **3-tier** severity model —
> `preventive` (blue) / `urgent_care` (amber) / `emergency` (red). The old two-state
> `clinical_alert` value is **gone**. The dataset is [triage_dataset.json](triage_dataset.json) —
> a single flat array of 24 conditions, each with a `severity_rank` (1–10). The multi-turn loop is
> carried by `pending_triage_update`. Detailed API/prompt/Zod contracts live in
> **[contracts.MD](contracts.MD)** (authoritative); the runtime prompt + fallback live in
> **[prompt_instruction.md](prompt_instruction.md)** and **[fallback_responses.json](fallback_responses.json)**.
> The V4 "Recovery Check-in" flow has been **removed** (see §4).

---

# 🚀 AURA V5: The Complete Dual-Mode Health Guardian (Hackathon Master Blueprint)

**Core Mission:** A voice-first, dual-mode AI guardian that provides longitudinal tracking, active symptom triage, and dynamic health visualization without crossing the line into medical diagnosis.

---

## 1. System Architecture & Boundaries

### Pillar 1: Adaptive Frontend (Next.js + Zustand)

- **Role:** The patient-facing UI. Purely state-driven via a Zustand global store.
- **Voice Integration:** Browser-native **Web Speech API** (`window.SpeechRecognition`) captures and transcribes spoken entries via a **Push-to-Talk** button (no silence detection — the transcript is sent only on button release). Requires HTTPS in production (Vercel).
- **Theming:** Automatically snaps between three tiers based on `detected_mode`: `preventive` (calm blue/green), `urgent_care` (amber — needs a doctor, non-locking), and `emergency` (high-contrast red, locks the screen).
- **Safety UI:** Displays a persistent medical disclaimer. Houses the "Emergency Dismiss" reset button if the crisis flow is triggered.

### Pillar 2: Core Gateway & Data Controller (NestJS)

- **Role:** The traffic controller, database owner, and fail-safe layer.
- **Audio Orchestration:** Calls **ElevenLabs** for text-to-speech so API keys never touch the browser.
- **Validation:** Uses Zod to strictly validate the LLM's JSON response before passing it to the frontend.

### Pillar 3: Active Triage Engine (Python FastAPI)

- **Role:** The stateless clinical reasoning engine.
- **Logic:** Uses semantic matching (not regex) against the `triage_dataset.json` reference graph.
- **Context:** Entirely stateless. It relies on NestJS to pass the user's baseline and historical logs on every single request.

---

## 2. The Database Schema (Prisma / PostgreSQL)

This schema tracks multi-turn conversations and emergency states without losing context between voice inputs.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                   String      @id @default(uuid())
  age                  Int
  sex                  String
  chronicConditions    String[]    // e.g., ["asthma", "hypertension"]
  currentMeds          String[]    // e.g., ["blood_thinner"]

  // Emergency contacts shown on the red lock screen
  emergencyContactName  String?
  emergencyContactPhone String?

  // Persistent Global State (3-tier: only "emergency" locks/persists)
  activeMode           String      @default("preventive") // "preventive" | "urgent_care" | "emergency"

  // Session & Safety State
  isEmergencyState     Boolean     @default(false)
  pendingTriage        Json?       // Multi-turn bookmark: { "condition_id": "acute_appendicitis", "turn": 1 }

  healthLogs           HealthLog[]
  exaInsights          ExaInsight[]
}

model HealthLog {
  id                String      @id @default(uuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  createdAt         DateTime    @default(now())

  rawAudioText        String    // Raw Web Speech API transcript
  detectedMode        String    // Per-log tier: "preventive" | "urgent_care" | "emergency"
  detectedConditionId String?   // Set on resolve/emergency; powers the 7-day trend SQL. null on follow-ups.
  severityScore       Int?      // Nullable: mapped from the matched condition's severity_rank; null on ask_follow_up

  extractedMetrics    Json      // Dashboard metrics with EXACT keys: {"pain_level": 4, "sleep_hours": 6}
  aiResponseText      String    // The exact string sent to ElevenLabs
}

model ExaInsight {
  id                String      @id @default(uuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  createdAt         DateTime    @default(now())

  triggerSymptom    String
  articleTitle      String
  articleUrl        String
  aiSummary         String
}

```

---

## 3. Strict API Contracts

To ensure the Next.js, NestJS, and Python services communicate flawlessly, these contracts must be strictly enforced.

### A. The Python Request Payload (Pydantic)

NestJS must send this exact object to Python on every turn so the AI never loses context.

```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class UserBaseline(BaseModel):
    age: int
    sex: str
    chronicConditions: List[str]
    currentMeds: List[str]

class RecentLog(BaseModel):
    rawAudioText: str
    detectedConditionId: Optional[str] = None  # for trend detection
    extractedMetrics: Dict[str, Any]
    createdAt: str

class PendingTriage(BaseModel):                 # the multi-turn bookmark
    condition_id: str
    turn: int

class TriageRequest(BaseModel):
    transcript: str
    baseline: UserBaseline
    recentLogs: List[RecentLog]                 # Populated by NestJS querying the last 7 days
    pendingTriage: Optional[PendingTriage] = None  # None on a fresh turn

```

### B. The AI Response Validation (NestJS / Zod)

NestJS will validate Python's response against this schema. If Python hallucinates a bad JSON structure, the `catch` block intercepts it and serves the `fallback_responses.json` cache.

```typescript
import { z } from "zod";

const PendingTriageSchema = z.object({
  condition_id: z.string(),
  turn: z.number().int()
});

const AuraResponseSchema = z.object({
  action_type: z.enum([
    "ask_follow_up", // Mid-triage multi-turn question
    "resolve", // End of triage, triggers Exa search + writes detectedConditionId
    "emergency_escalation", // Bypass or confirmed deadly secondary symptom
    "general_response" // Unrelated chatter ("feeling fine today") — NOT logged
  ]),
  detected_mode: z.enum(["preventive", "urgent_care", "emergency"]),
  detected_condition_id: z.string().nullable(),
  extracted_dashboard_metrics: z.record(z.any()),
  ai_spoken_response: z.string(),
  trigger_exa_search: z.string().nullable(),
  pending_triage_update: PendingTriageSchema.nullable()
});
```

### C. The REST Layer (Next.js ↔ NestJS)

**Primary endpoint — drives the whole app:** `POST /api/triage/turn`

```json
// Request (Next.js → NestJS)
{ "userId": "uuid-string", "transcript": "My chest hurts" }
```

NestJS attaches the user's baseline + last-7-days logs + pendingTriage, calls the AI, validates
with Zod, writes a `HealthLog` (see rules below), then returns this exact shape to Next.js:

```json
// Response (NestJS → Next.js) — matches fallback_responses.json 1:1
{
  "action_type": "ask_follow_up",
  "detected_mode": "urgent_care",
  "ai_spoken_response": "Are you experiencing any crushing chest pressure?",
  "audio_base64": "UklGRiQAAABXQVZF...", // ElevenLabs MP3 as base64; null on fallback
  "is_emergency_state": false,
  "updated_metrics": { "pain_level": 4, "sleep_hours": null },
  "exa_insight": null // { "title", "url", "summary" }, populated ONLY on "resolve"
}
```

**HealthLog write rules (per turn):**
| `action_type` | Log written? | `detectedConditionId` | `severityScore` | `pendingTriage` |
|---|---|---|---|---|
| `ask_follow_up` | yes | null | null | **set** to `pending_triage_update` |
| `resolve` | yes | condition_id | severity_rank (looked up in dataset) | **clear → null** |
| `emergency_escalation` | yes | condition_id (if any) | severity_rank | **clear → null**; `isEmergencyState=true`, `activeMode="emergency"` |
| `general_response` | **NO — skip log entirely** | — | — | **clear → null** |

**Reset endpoint:** `PATCH /api/users/reset-emergency` → sets `isEmergencyState=false`,
`activeMode="preventive"` (fired by the "Crisis Handled / Dismiss" button on the red screen).

> Only `emergency` persists/locks. `urgent_care` and `preventive` color only that one response.
> Full field-by-field definitions live in [contracts.MD](contracts.MD).

---

## 4. Core Logic Workflows

### 1. Trend Surfacing (SQL Memory)

Before calling Python, NestJS runs a query to grab the last 7 days of `HealthLog` entries. Python's LLM prompt explicitly instructs it to review this array for repeating symptoms (e.g., "User mentioned headaches 3 times this week") and factor that into the triage.

### 2. The Conflict Resolution Rule

If a symptom matches multiple conditions, the LLM sorts by `severity_rank` (descending) and cross-examines the highest first (see the Differential Protocol in [prompt_instruction.md](prompt_instruction.md)). It never assumes a milder condition until the deadlier one is ruled out.

### 3. The Three Tiers & Emergency Reset

- **`preventive` (blue) / `urgent_care` (amber):** transient — they color only the current response. They do NOT lock or persist. A mild UTI or migraine shows amber but the app stays interactive.
- **`emergency` (red):** the only tier that persists and locks. If the AI returns `emergency_escalation`, NestJS sets `User.isEmergencyState = true` and `activeMode = "emergency"`. Next.js locks the screen, turns it red, and displays 911 + `emergencyContactName`/`emergencyContactPhone`.
- **Reset:** The **"Crisis Handled / Dismiss"** button on the red UI hits `PATCH /api/users/reset-emergency`, flipping `isEmergencyState=false` and `activeMode="preventive"`.

> **Removed in V5:** the old "Recovery Check-in" flow. It existed to exit a persistent `clinical_alert` lock, which no longer exists — `urgent_care` never locks, and `emergency` is cleared by the Dismiss button above. **Do not build it.**

---

## 5. Live Demo Fail-Safes

- **Exa Multi-Domain Mesh:** Exa queries must use logical OR operators to avoid zero-result errors: `(site:mayoclinic.org OR site:cdc.gov OR site:nih.gov) [Symptom query]`.
- **The "Safe Mode" Cache:** A hardcoded [fallback_responses.json](fallback_responses.json) sits in the NestJS server, matching the `/api/triage/turn` response shape 1:1. On a hard failure the `catch` block returns it directly. `audio_base64` is `null` (we sacrifice voice and degrade to instant on-screen text — no need to pre-generate MP3s). Keyword selection between the safe vs. emergency object uses hard combinations only (see [prompt_instruction.md](prompt_instruction.md)); the bare word "pain" is NOT a trigger.
- **CORS Pre-Flight:** Configure CORS in NestJS `main.ts` in Hour 1 to accept the Next.js origin (localhost:3001 in dev, the Vercel URL in prod).
- **Audio Autoplay Unlock:** Instantiate a global `Audio` object and play/pause a 1-frame silent clip on the Push-to-Talk `mousedown` (a valid user gesture) so the later base64 response can `.play()` without Chrome blocking it. Wrap the response `.play()` in `.catch()` to degrade to text.
- **HTTPS everywhere:** Web Speech API needs HTTPS. Deploy Next.js to Vercel and the NestJS/Postgres backend to Railway/Render (both auto-provision SSL) — an HTTPS frontend cannot call an HTTP backend (mixed-content block).

---

## 6. Infrastructure Automation (Hour 1 Setup)

To eliminate manual terminal setups and keep environments identical across the team, place this `docker-compose.yml` in the root directory. Run `docker compose up -d` to instantly containerize and spin up the database, backend, and API gateways.

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: aura_user
      POSTGRES_PASSWORD: aura_password
      POSTGRES_DB: aura_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  python_ai:
    build: ./python-backend
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  nestjs_gateway:
    build: ./nestjs-backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://aura_user:aura_password@postgres:5432/aura_db
      - PYTHON_SERVICE_URL=http://python_ai:8000
      - EXA_API_KEY=${EXA_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
    depends_on:
      - postgres
      - python_ai

  nextjs_frontend:
    build: ./nextjs-frontend
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    depends_on:
      - nestjs_gateway

volumes:
  postgres_data:
```

---

## 7. The 24-Hour Execution Timeline

1. **Hours 1-4: The Foundation:** Independent scaffolding & environment setup.

- **Senior Dev:** Run Docker Compose. Push the Prisma schema. Scaffold NestJS endpoints and Zod validation.
- **Data Scientist:** Wire the locked [triage_dataset.json](triage_dataset.json) into the FastAPI system prompt. Build the endpoint with the exact Pydantic `TriageRequest` model + structured JSON output.
- **Mid-Level Dev:** Scaffold Next.js and the Zustand store. Build the `DashboardLayout` wrapper that toggles the 3-tier Tailwind themes (blue `preventive` / amber `urgent_care` / red `emergency`) off `detected_mode`.

2. **Hours 5-10: The Brain Connection:** Wiring logic and establishing state memory.

- **Data Scientist & Senior Dev:** Connect NestJS to Python. Ensure NestJS passes the 7-day Postgres history array and baseline context on every request.
- **Mid-Level Dev:** Wire the Web Speech API to a **Push-to-Talk** button (send transcript on release), unlock the global `Audio` object on `mousedown`. Ensure the frontend posts to `/api/triage/turn` and parses the 4 `action_types` correctly.

3. **Hours 11-16: Media & Sponsors:** Activating sponsor APIs and fallback mechanisms.

- **Senior Dev:** Build the ElevenLabs loop in NestJS (return audio as **base64** in the JSON — no S3/file streaming). Implement the Exa call triggered by `resolve` (request `highlights`, guard for zero results, map to `exa_insight`). Wire the [fallback_responses.json](fallback_responses.json) fail-safe.
- **Mid-Level Dev:** Build the **Recharts** 7-day dashboard (two metrics: `pain_level`, `sleep_hours`), the 3-tier theme switch (blue/amber/red), the conversation overlay (last 3 messages), the `exa_insight` card, and the "Crisis Handled / Dismiss" reset button. (No Recovery Check-in — removed in V5.)

4. **Hours 17-24: Polish & Pitch:** Code freeze and deployment.

- Deploy Next.js to **Vercel** (auto HTTPS for the mic) and the NestJS/Postgres backend to **Railway/Render** (auto HTTPS). Set `NEXT_PUBLIC_API_URL` to the HTTPS backend URL.
- Seed the Postgres DB: the hardcoded demo user (`NEXT_PUBLIC_DEMO_USER_ID`) with a **benign baseline** (`chronicConditions: ["mild eczema"]`, `currentMeds: ["multivitamin"]` — proves personalization without hijacking scripted scenarios), emergency contacts, and **4 days of history** where each `extractedMetrics` contains `{"pain_level": X, "sleep_hours": Y}` and a repeating `detectedConditionId` so the trend graph + trend surfacing both fire live.
- Lock down and rehearse the live demo script.
