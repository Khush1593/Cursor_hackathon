# Aura Frontend

Voice-first adaptive UI for **Aura** — Next.js (App Router) + Zustand + Tailwind + Recharts.

Runs on **http://localhost:3001**. Talks only to the NestJS backend at `NEXT_PUBLIC_API_URL` (or local mock for triage when `NEXT_PUBLIC_USE_MOCK=1`).

## Quick start

```bash
cd Frontend
cp .env.local.example .env.local
# Point NEXT_PUBLIC_API_URL at localhost:3000 or your ngrok HTTPS URL
npm install
npm run dev
```

Open **http://localhost:3001/login** (dashboard is cookie-protected).

## Auth (ready — integrated)

Cookie sessions per `Backend/api_documentation.md`. Tokens are **never** stored in JS storage.

| Route                     | API                                                    |
| ------------------------- | ------------------------------------------------------ |
| `/login`                  | `POST /api/auth/login`                                 |
| `/register`               | `POST /api/auth/register`                              |
| `/forgot-password`        | `POST /api/auth/forgot-password`                       |
| `/reset-password?token=…` | `POST /api/auth/reset-password`                        |
| App boot                  | `GET /api/auth/me` (+ `POST /api/auth/refresh` on 401) |
| Log out                   | `POST /api/auth/logout`                                |

Every call uses `credentials: "include"`. Backend `FRONTEND_ORIGIN` must match `http://localhost:3001`.

## Env

| Variable               | Purpose                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`  | NestJS base (`http://localhost:3000` or ngrok HTTPS). Browser calls **`/api-proxy`** (same-origin rewrite) so HttpOnly cookies work. |
| `NEXT_PUBLIC_USE_MOCK` | `1` = mock triage/dashboard; auth still hits real API. `0` = real triage too                                                         |

After changing `NEXT_PUBLIC_API_URL`, **restart** `npm run dev` (rewrites load at startup).

### Ngrok checklist

1. Set `NEXT_PUBLIC_API_URL=https://your-subdomain.ngrok-free.app` in `.env.local`
2. Backend `.env`: `FRONTEND_ORIGIN=http://localhost:3001` (exact match)
3. Restart frontend dev server
4. Open http://localhost:3001/login → register / sign in

## Stack

| Piece     | Choice                                    |
| --------- | ----------------------------------------- |
| Framework | Next.js App Router                        |
| State     | Zustand (`store/aura.store.ts`)           |
| Charts    | Recharts (`MetricsChart`)                 |
| Voice in  | Web Speech API Push-to-Talk               |
| Voice out | Backend `audio_base64` via `lib/audio.ts` |
| Styling   | Tailwind CSS                              |

See [frontend.md](./frontend.md) for the frozen triage contract.
