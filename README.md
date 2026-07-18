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
| **Backend** | NestJS 11 + Prisma + PostgreSQL | `3000` | Auth, triage orchestration, integrations |
| **Python** | FastAPI + Gemini | `8000` | Stateless clinical reasoning (`POST /triage`) |

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Run with Docker (recommended)](#run-with-docker-recommended)
3. [Run locally (without Docker)](#run-locally-without-docker)
4. [Environment variables](#environment-variables)
5. [Useful URLs](#useful-urls)
6. [Modules & features](#modules--features)
7. [Example flows](#example-flows)
8. [Project structure](#project-structure)
9. [Troubleshooting](#troubleshooting)
10. [Summary (easy words)](#summary-easy-words)

---

## Prerequisites

- **Docker** + **Docker Compose** (for the one-command stack), **or**
- **Node.js 22+**, **Python 3.12+**, and **PostgreSQL 15+** (for local development)
- Optional API keys:
  - `GEMINI_API_KEY` — real AI triage (Python)
  - `ELEVENLABS_API_KEY` — spoken audio replies (Backend)
  - `EXA_API_KEY` — clinic / resource search (Backend)

Without Gemini you can still smoke-test using AI stubs (`PYTHON_USE_AI_STUB=1` or `USE_AI_STUB=true`).

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

First boot runs Prisma migrations automatically inside the Backend container.

### 3. Open the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Login | http://localhost:3001/login |
| Backend Swagger | http://localhost:3000/api/docs |
| Backend health | http://localhost:3000/api/health |
| Python health | http://localhost:8000/health |

### 4. Stop

```bash
docker compose down          # keep database volume
docker compose down -v       # also wipe Postgres data
```

### How Docker networking works

| From → To | Address used | Why |
|-----------|--------------|-----|
| Browser → Frontend | `http://localhost:3001` | You open this in the browser |
| Frontend → Backend | `http://backend:3000` | Next.js rewrite (`/api-proxy` → Nest). Built into the Frontend image |
| Backend → Python | `http://python_ai:8000` | Nest calls `POST /triage` |
| Backend → Postgres | `postgres:5432` | Prisma `DATABASE_URL` |
| CORS / cookies | `FRONTEND_ORIGIN=http://localhost:3001` | Must match the browser Origin |

> Do **not** set `FRONTEND_ORIGIN` to the container name `frontend`. CORS cares about the URL the user types in the browser.

### Port conflicts

If something on your machine already uses `3000`, `3001`, `8000`, or `5432`, override host ports in `.env`:

```env
BACKEND_PORT=3002
FRONTEND_PORT=3001
PYTHON_PORT=8001
POSTGRES_PORT=5433
```

Then reopen the Frontend on the port you chose.

---

## Run locally (without Docker)

Use three terminals (plus a running Postgres).

### 0. Database

Create a DB matching `Backend/.env.example`:

```text
postgresql://aura_user:aura_password@localhost:5432/aura_db
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

See [`.env.example`](./.env.example). Important knobs:

| Variable | Meaning |
|----------|---------|
| `JWT_SECRET` | Signs access/refresh cookies — change in any shared environment |
| `FRONTEND_ORIGIN` | Exact browser origin (default `http://localhost:3001`) |
| `GEMINI_API_KEY` | Google Gemini key for Python triage |
| `PYTHON_USE_AI_STUB` | `1` = Python returns deterministic stubs (no Gemini) |
| `BACKEND_USE_AI_STUB` | `true` = Nest skips Python entirely |
| `ELEVENLABS_*` / `EXA_API_KEY` | Optional voice + clinic search |
| `NEXT_PUBLIC_USE_MOCK` | Frontend build arg: `1` = mock triage UI handlers |

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
| Forgot / reset password | `/forgot-password` · `/reset-password` |
| API docs (Swagger) | http://localhost:3000/api/docs |
| Backend health | `GET /api/health` |
| Python health / ready | `GET /health` · `GET /ready` |

---

## Modules & features

### Frontend (`Frontend/`)

| Module | What it does |
|--------|----------------|
| **Auth pages** | Register, login, logout, forgot/reset password |
| **Session client** | Cookie-based API client (`lib/api.ts`) with refresh-on-401 |
| **Voice input** | Push-to-talk via Web Speech API |
| **Voice output** | Plays Backend `audio_base64` replies |
| **Triage UI** | Sends turns to `POST /api/triage/turn`, shows spoken + UI text |
| **Dashboard** | Metrics charts (Recharts), recurring conditions, emergency banner |
| **Zustand store** | Client state for session, mode, metrics |
| **API proxy** | `/api-proxy` rewrite keeps cookies same-origin |

**Example — login (browser):**

```http
POST /api-proxy/api/auth/login
Content-Type: application/json

{ "email": "demo@aura.health", "password": "SecurePass1!" }
```

Cookies `aura_access_token` / `aura_refresh_token` are set as HttpOnly (never in `localStorage`).

---

### Backend (`Backend/`)

| Module | Path | What it does |
|--------|------|----------------|
| **Auth** | `src/auth` | Register, login, refresh, logout, me, password reset |
| **Users** | `src/users` | Dashboard, history, location, handoff, export/delete data |
| **Triage** | `src/triage` | Orchestrates one turn: Python → validate → persist → TTS/Exa |
| **Consent** | `src/consent` | Record / read HIPAA-style consent |
| **Feedback** | `src/feedback` | User feedback on triage quality |
| **Mail** | `src/mail` | Nodemailer password-reset emails |
| **Integrations** | `src/integrations` | Python AI client, ElevenLabs TTS, Exa search |
| **Audit** | `src/audit` | Security / access audit trail |
| **Prisma** | `prisma/` | PostgreSQL schema + migrations |
| **Fallbacks** | `src/data` | Offline keyword fallbacks if AI is down |

**Example — triage turn:**

```http
POST /api/triage/turn
Cookie: aura_access_token=...
Content-Type: application/json

{
  "transcript": "I have a fever and a bad cough for two days",
  "user_context": { "age": 34, "sex": "female" }
}
```

Typical response fields (contract-style):

```json
{
  "action_type": "general_response",
  "detected_mode": "urgent_care",
  "ai_spoken_response": "Based on fever and cough lasting two days…",
  "ui_display_text": "Urgent care suggested",
  "audio_base64": null
}
```

**Severity modes:**

| Mode | Meaning |
|------|---------|
| `preventive` | Low risk — tips, monitoring, lifestyle |
| `urgent_care` | See a clinician soon (not ER) |
| `emergency` | Seek emergency care / escalate contacts |

---

### Python AI (`Python/`)

| Module | File | What it does |
|--------|------|----------------|
| **API** | `main.py` | FastAPI app: `/health`, `/ready`, `/triage`, `/tts` |
| **Models** | `models.py` | Frozen Nest contract (`TriageRequest` / `AuraResponse`) |
| **LLM** | `llm.py` | Gemini structured output |
| **Prompt** | `prompt.py` | System prompt + differential protocol |
| **Config** | `config.py` | Env + stub flags |
| **TTS demo** | `tts.py` | Optional ElevenLabs path (Nest owns production TTS) |
| **Dataset** | `triage_dataset.json` | Condition severity reference |

**Example — Nest → Python:**

```http
POST http://python_ai:8000/triage
Content-Type: application/json

{
  "transcript": "Sharp chest pain and shortness of breath",
  "user_context": { "age": 55, "sex": "male", "chronic_conditions": [] }
}
```

Python returns JSON matching `AuraResponse`. Nest validates, translates field names for the Frontend, may attach TTS audio, and persists history.

---

### Shared / infra

| Piece | Role |
|-------|------|
| `docker-compose.yml` | Runs all four services with healthchecks |
| `Project_Instructions/project_knowledge.md` | Architecture + contracts source of truth |
| `Backend/api_documentation.md` | Auth & API details for Frontend |

---

## Example flows

### A. First-time user (happy path)

1. Open http://localhost:3001/register  
2. Create an account (email, password, age, sex, optional meds/contacts)  
3. Accept consent when prompted  
4. Land on the dashboard / voice triage screen  
5. Hold push-to-talk (or type): *“I’ve had a mild headache for a day”*  
6. Backend calls Python → UI shows mode + spoken reply (and audio if ElevenLabs is configured)

### B. Smoke test without API keys

```env
PYTHON_USE_AI_STUB=1
BACKEND_USE_AI_STUB=false
NEXT_PUBLIC_USE_MOCK=0
```

```bash
docker compose up --build
```

Register → login → send a triage turn. Python returns deterministic stubs; Nest still exercises the full path.

### C. Frontend-only mock triage

In `Frontend/.env.local` (local Next only):

```env
NEXT_PUBLIC_USE_MOCK=1
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Auth still hits Nest; triage/dashboard can use local mock route handlers.

### D. Health checks

```bash
curl http://localhost:8000/health
curl http://localhost:3000/api/health
curl http://localhost:3001/api-proxy/api/health   # Frontend rewrite → Backend
```

---

## Project structure

```text
Cursor_hackathon/
├── Frontend/                 # Next.js UI (:3001)
│   ├── Dockerfile
│   ├── app/                  # App Router pages
│   ├── components/
│   ├── lib/                  # API client, audio helpers
│   └── store/                # Zustand
├── Backend/                  # NestJS gateway (:3000)
│   ├── Dockerfile
│   ├── docker-entrypoint.sh  # prisma migrate + start
│   ├── prisma/
│   └── src/                  # auth, triage, users, …
├── Python/                   # FastAPI triage engine (:8000)
│   ├── Dockerfile
│   ├── main.py
│   ├── llm.py
│   └── triage_dataset.json
├── Project_Instructions/     # Specs & knowledge base
├── docker-compose.yml
├── .env.example
└── README.md                 # this file
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS / cookies fail on login | `FRONTEND_ORIGIN` must exactly match the browser URL (e.g. `http://localhost:3001`) |
| Frontend can’t reach API in Docker | Rebuild Frontend after changing rewrite target; inside Compose it must be `http://backend:3000` |
| Backend can’t reach Python | In Docker use `PYTHON_SERVICE_URL=http://python_ai:8000`; locally use `http://localhost:8000` |
| Port already in use | Stop local Nest/uvicorn/Postgres, or change `*_PORT` in `.env` |
| Prisma errors on start | Ensure Postgres is healthy; entrypoint runs `prisma migrate deploy` |
| Empty / slow AI replies | Set a valid `GEMINI_API_KEY`, or enable stubs for demos |
| Password reset email missing | Configure `MAIL_*` or use `MAIL_DEV_EXPOSE_TOKEN=true` in local/dev only |

```bash
docker compose logs -f backend
docker compose logs -f python_ai
docker compose logs -f frontend
```

---

## Summary (easy words)

**Aura** is a small health helper made of three apps that talk to each other.

1. **Frontend** is the website you open. You sign in, speak or type how you feel, and see advice and charts.  
2. **Backend** is the middle manager. It checks who you are (secure cookies), saves your history in a database, calls the AI, and can add voice audio or clinic search.  
3. **Python** is the AI brain. It reads your symptoms and returns a careful JSON answer: what mode you’re in (mild / urgent / emergency) and what to say next.  

You can start everything with **one Docker command**, or run each app yourself on ports **3001**, **3000**, and **8000**.  

Aura is built for demos and learning — it **does not replace a doctor**. For real emergencies, call local emergency services.
