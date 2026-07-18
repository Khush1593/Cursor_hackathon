# Aura

Voice-first AI health guardian for a healthcare hackathon.

Aura helps users describe symptoms by voice or text, then triages them into one of three modes — **preventive**, **urgent care**, or **emergency** — and guides the next step. It is **not** a medical device and does **not** diagnose.

```
Browser  →  Frontend (:3001)  →  Backend (:3000)  →  Python AI (:8000)
                                      ↓
                                 PostgreSQL (:5432)
```

| App | Stack | Port | Role |
|-----|--------|------|------|
| **Frontend** | Next.js 16 + React 19 + Zustand + Tailwind | `3001` | Voice UI, auth pages, dashboard |
| **Backend** | NestJS 11 + Prisma + PostgreSQL | `3000` | Auth, triage orchestration, fairness, integrations |
| **Python** | FastAPI + Gemini | `8000` | Stateless clinical reasoning (`POST /triage`) |

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Run with Docker (recommended)](#run-with-docker-recommended)
3. [Run locally (without Docker)](#run-locally-without-docker)
4. [Environment variables](#environment-variables)
5. [Useful URLs](#useful-urls)
6. [Modules & features](#modules--features)
7. [Nest ↔ Python contract (fairness, reasoning_trace, e2e)](#nest--python-contract-fairness-reasoning_trace-e2e)
8. [Example flows](#example-flows)
9. [Project structure](#project-structure)
10. [Troubleshooting](#troubleshooting)
11. [Summary (easy words)](#summary-easy-words)

---

## Prerequisites

- **Docker** + **Docker Compose** (for the one-command stack), **or**
- **Node.js 22+**, **Python 3.12+**, and **PostgreSQL 15+** (for local development)
- Optional API keys:
  - `GEMINI_API_KEY` — real AI triage (Python)
  - `ELEVENLABS_API_KEY` — spoken audio replies (Backend)
  - `EXA_API_KEY` — clinic / resource search (Backend)

Without Gemini you can still smoke-test using AI stubs (`USE_AI_STUB=1` in Python, or `USE_AI_STUB=true` in Nest).

---

## Run with Docker (recommended)

This starts **Frontend + Backend + Python + Postgres** on one shared network.

### 1. Configure env

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```env
JWT_SECRET=some-long-random-string
GEMINI_API_KEY=your-gemini-key          # or leave empty and use stubs below
PYTHON_USE_AI_STUB=0                    # set to 1 to skip Gemini
BACKEND_USE_AI_STUB=false               # true = Nest never calls Python
```

### 2. Build and start

```bash
docker compose up --build
```

First boot runs Prisma migrations automatically inside the Backend container (including fairness aggregates).

### 3. Open the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Login | http://localhost:3001/login |
| Backend Swagger | http://localhost:3000/api/docs |
| Backend health | http://localhost:3000/api/health |
| Fairness stats (Nest) | http://localhost:3000/api/fairness/stats |
| Python health | http://localhost:8000/health |
| Python fairness (in-memory) | http://localhost:8000/fairness/stats |

### 4. Stop

```bash
docker compose down          # keep database volume
docker compose down -v       # also wipe Postgres data
```

### How Docker networking works

| From → To | Address used | Why |
|-----------|--------------|-----|
| Browser → Frontend | `http://localhost:3001` | You open this in the browser |
| Frontend → Backend | `http://backend:3000` | Next.js rewrite (`/api-proxy` → Nest) |
| Backend → Python | `http://python_ai:8000` | Nest calls `POST /triage` |
| Backend → Postgres | `postgres:5432` | Prisma `DATABASE_URL` |
| CORS / cookies | `FRONTEND_ORIGIN=http://localhost:3001` | Must match the browser Origin |

> Do **not** set `FRONTEND_ORIGIN` to the container name `frontend`. CORS cares about the URL the user types in the browser.

### Port conflicts

If something already uses `3000`, `3001`, `8000`, or `5432`, override host ports in `.env`:

```env
BACKEND_PORT=3002
FRONTEND_PORT=3001
PYTHON_PORT=8001
POSTGRES_PORT=5433
```

---

## Run locally (without Docker)

Use three terminals (plus a running Postgres).

### 0. Database

```text
postgresql://aura_user:aura_password@localhost:5432/aura_db
```

```bash
cd Backend
npx prisma migrate deploy
```

### 1. Python AI — port 8000

```bash
cd Python
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # set GEMINI_API_KEY or USE_AI_STUB=1
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check: http://localhost:8000/health → `{"status":"ok"}`

### 2. Backend — port 3000

```bash
cd Backend
cp .env.example .env
# DATABASE_URL → localhost Postgres
# PYTHON_SERVICE_URL=http://localhost:8000
# FRONTEND_ORIGIN=http://localhost:3001
npm install
npx prisma migrate deploy
npm run start:dev
```

Check: http://localhost:3000/api/health → `{"status":"ok"}`  
Swagger: http://localhost:3000/api/docs

### 3. Frontend — port 3001

```bash
cd Frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3000
# NEXT_PUBLIC_USE_MOCK=0
npm install
npm run dev
```

Open: http://localhost:3001/login

The browser always calls **same-origin** `/api-proxy/*`. Next.js rewrites that path to `NEXT_PUBLIC_API_URL` so HttpOnly auth cookies stay on `:3001`.

---

## Environment variables

### Root `.env` (Docker Compose)

See [`.env.example`](./.env.example) when present. Important knobs:

| Variable | Meaning |
|----------|---------|
| `JWT_SECRET` | Signs access/refresh cookies |
| `FRONTEND_ORIGIN` | Exact browser origin (default `http://localhost:3001`) |
| `GEMINI_API_KEY` | Google Gemini key for Python triage |
| `PYTHON_USE_AI_STUB` / `USE_AI_STUB` | Stub AI without Gemini |
| `BACKEND_USE_AI_STUB` | Nest skips Python entirely |
| `ELEVENLABS_*` / `EXA_API_KEY` | Optional voice + clinic search |

### Per-app examples (local dev)

| App | File |
|-----|------|
| Frontend | `Frontend/.env.local.example` |
| Backend | `Backend/.env.example` |
| Python | `Python/.env.example` |

---

## Useful URLs

| What | URL |
|------|-----|
| App home / dashboard | http://localhost:3001 |
| Login / Register | http://localhost:3001/login · `/register` |
| API docs (Swagger) | http://localhost:3000/api/docs |
| Backend health | `GET /api/health` |
| Nest fairness (Postgres) | `GET /api/fairness/stats` |
| Nest fairness sync | `POST /api/fairness/sync` |
| Python health / ready | `GET /health` · `GET /ready` |
| Python fairness (RAM) | `GET /fairness/stats` |

---

## Modules & features

### Frontend (`Frontend/`)

| Module | What it does |
|--------|----------------|
| **Auth pages** | Register, login, logout, forgot/reset password |
| **Session client** | Cookie-based API client (`lib/api.ts`) with refresh-on-401 |
| **Voice input** | Push-to-talk via Web Speech API |
| **Voice output** | Plays Backend `audio_base64` replies |
| **Triage UI** | Sends turns to `POST /api/triage/turn` |
| **Explainability** | Stores `reasoning_trace` → shows in emergency / handoff UI |
| **Dashboard** | Metrics charts (Recharts), recurring conditions |
| **API proxy** | `/api-proxy` rewrite keeps cookies same-origin |

**Example — login (browser):**

```http
POST /api-proxy/api/auth/login
Content-Type: application/json

{ "email": "demo@aura.health", "password": "SecurePass1!" }
```

### Backend (`Backend/`)

| Module | Path | What it does |
|--------|------|----------------|
| **Auth** | `src/auth` | Register, login, refresh, logout, me, password reset |
| **Users** | `src/users` | Dashboard, history, location, handoff, export/delete |
| **Triage** | `src/triage` | Orchestrates one turn: Python → Zod → persist → TTS/Exa |
| **Fairness** | `src/fairness` | Durable non-PHI aggregates in Postgres |
| **Consent** | `src/consent` | HIPAA-style consent |
| **Feedback** | `src/feedback` | “Incorrect triage” flags |
| **Integrations** | `src/integrations` | Python AI, ElevenLabs, Exa |
| **Fallbacks** | `src/data` | Offline keyword fallbacks if AI returns 502 |

**Example — triage turn:**

```http
POST /api/triage/turn
Cookie: aura_access_token=...
Content-Type: application/json

{
  "transcript": "I have a fever and a bad cough for two days",
  "inputMode": "text"
}
```

Response includes `reasoning_trace` (1–3 short explainability bullets) for the UI.

### Python AI (`Python/`)

| Module | File | What it does |
|--------|------|----------------|
| **API** | `main.py` | `/health`, `/ready`, `/triage`, `/tts`, `/fairness/stats` |
| **Models** | `models.py` | Frozen Nest contract (`AuraResponse` + `reasoning_trace`) |
| **LLM** | `llm.py` | Gemini / stub; stroke → emergency bypass |
| **Fairness** | `fairness.py` | In-memory counters (reset on process restart) |

**Stroke example (Nest-shaped body):**

```http
POST http://localhost:8000/triage
Content-Type: application/json

{
  "transcript": "my face is drooping and speech slurred",
  "baseline": { "age": 58, "sex": "male", "chronicConditions": ["hypertension"], "currentMeds": ["lisinopril"] },
  "recentLogs": [],
  "recurringConditions": [],
  "pendingTriage": null
}
```

Expected: `action_type: "emergency_escalation"`, `detected_mode: "emergency"`, `reasoning_trace` with stroke/bypass why-bullets. On LLM failure Python returns **502** — Nest owns `fallback_responses.json`.

---

## Nest ↔ Python contract (fairness, reasoning_trace, e2e)

### `reasoning_trace`

- Python returns 1–3 short non-PHI bullets on every triage.
- Nest validates with Zod (`aura.schema.ts`) and **passes them through** on `POST /api/triage/turn`.
- **Frontend already supports this** (`lastReasoningTrace` in the store, shown in emergency / handoff UI).  
  **No Frontend code changes are required** for the Nest fairness / e2e / `reasoning_trace` work.

### Fairness aggregates (non-PHI)

| Layer | Storage | Notes |
|-------|---------|--------|
| Python `GET /fairness/stats` | In-memory | Resets when Python restarts |
| Nest `GET /api/fairness/stats` | **Postgres** (`FairnessAggregate`) | Durable — Nest records after each successful triage |
| Nest `POST /api/fairness/sync` | Scrapes Python → merges with `GREATEST(db, python)` | Picks up direct Python traffic |

Buckets only: `age_band` × `sex_group` × `action_type` × `detected_mode` × `count`.  
**Never** stores user IDs, transcripts, or condition narratives.

```bash
curl http://localhost:3000/api/fairness/stats
curl -X POST http://localhost:3000/api/fairness/sync
```

### Nest e2e / CI tests

Calls **real** `PYTHON_SERVICE_URL` over HTTP (not Python’s TestClient):

- Zod parse of `AuraResponse` (including `reasoning_trace`)
- Stroke transcript → `emergency_escalation`
- Simulated **502** → Nest `FallbackService` emergency fallback

```bash
# Terminal A — Python stub mode (deterministic CI)
cd Python && USE_AI_STUB=1 uvicorn main:app --port 8000

# Terminal B
cd Backend
PYTHON_SERVICE_URL=http://127.0.0.1:8000 npm run test:e2e
```

---

## Example flows

### A. First-time user

1. Open http://localhost:3001/register  
2. Create an account → accept consent  
3. Push-to-talk or type symptoms  
4. Backend calls Python → UI shows mode + spoken reply + `reasoning_trace`

### B. Smoke test without API keys

```env
USE_AI_STUB=1                 # Python
BACKEND_USE_AI_STUB=false     # Nest still calls Python
NEXT_PUBLIC_USE_MOCK=0
```

### C. Health checks

```bash
curl http://localhost:8000/health
curl http://localhost:3000/api/health
curl http://localhost:3001/api-proxy/api/health
curl http://localhost:3000/api/fairness/stats
```

---

## Project structure

```text
Cursor_hackathon/
├── Frontend/                 # Next.js UI (:3001)
├── Backend/                  # NestJS gateway (:3000)
│   ├── src/fairness/         # Durable fairness aggregates
│   ├── src/triage/           # Turn orchestration + fallback
│   ├── test/                 # e2e: real PYTHON_SERVICE_URL
│   └── prisma/               # schema + migrations
├── Python/                   # FastAPI triage engine (:8000)
│   ├── fairness.py           # In-memory counters
│   └── test_nest_integration.py
├── Project_Instructions/     # Specs & knowledge base
├── docker-compose.yml
└── README.md
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS / cookies fail on login | `FRONTEND_ORIGIN` must exactly match the browser URL |
| Frontend can’t reach API in Docker | Rewrite target must be `http://backend:3000` inside Compose |
| Backend can’t reach Python | Docker: `http://python_ai:8000` · local: `http://localhost:8000` |
| e2e skips live Python tests | Start Python (`USE_AI_STUB=1`) and set `PYTHON_SERVICE_URL` |
| Fairness empty after Python restart | Expected for Python RAM counters — Nest Postgres keeps durable counts |
| Prisma errors on start | `npx prisma migrate deploy` (includes fairness table) |

```bash
docker compose logs -f backend
docker compose logs -f python_ai
cd Backend && npm run test:e2e
```

---

## Summary (easy words)

**Aura** is a small health helper made of three apps that talk to each other.

1. **Frontend** is the website you open. You sign in, speak or type how you feel, and see advice — including short “why” bullets (`reasoning_trace`). No extra Frontend work was needed for the new Nest fairness / e2e features.  
2. **Backend** is the middle manager. It checks who you are, saves history, calls the AI, keeps **fairness stats** in the database (age band + sex group + outcome only — no private transcripts), and falls back safely if AI returns 502.  
3. **Python** is the AI brain. It reads symptoms and returns careful JSON (including stroke → emergency). Its own fairness counters live only in memory and reset when the process restarts.  

You can start everything with **Docker**, or run each app on ports **3001**, **3000**, and **8000**.  

Aura is for demos and learning — it **does not replace a doctor**. For real emergencies, call local emergency services.
