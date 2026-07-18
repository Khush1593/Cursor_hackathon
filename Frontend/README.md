# Aura Frontend

Voice-first adaptive UI for **Aura** — Next.js (App Router) + Zustand + Tailwind + Recharts.

Runs on **http://localhost:3001**. Talks only to the NestJS backend at `NEXT_PUBLIC_API_URL` (via same-origin `/api-proxy` rewrite).

## Quick start

```bash
cd Frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL to localhost:3000 or your ngrok/Railway HTTPS URL
npm install
npm run dev
```

Open **http://localhost:3001/login** (dashboard is cookie-protected).

After changing `NEXT_PUBLIC_API_URL`, **restart** `npm run dev` (rewrites load at startup).

## Auth

Cookie sessions per `Backend/api_documentation.md`. Tokens are **never** stored in JS storage.

| Route                     | API                                                    |
| ------------------------- | ------------------------------------------------------ |
| `/login`                  | `POST /api/auth/login`                                 |
| `/register`               | `POST /api/auth/register`                              |
| `/forgot-password`        | `POST /api/auth/forgot-password`                       |
| `/reset-password?token=…` | `POST /api/auth/reset-password`                        |
| App boot                  | `GET /api/auth/me` (+ `POST /api/auth/refresh` on 401) |
| Log out                   | `POST /api/auth/logout`                                |

Every call uses `credentials: "include"`. Backend `FRONTEND_ORIGIN` must match the frontend origin exactly.

## Product modules (dashboard)

| Tab            | Features                                                     | APIs                                                           |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Overview       | Orb PTT / text, conversation, reasoning, Exa (gated), trends | `POST /api/triage/turn`, consent                               |
| History        | Paginated sessions + flag incorrect                          | `GET /api/users/:id/history`, `POST /api/feedback`             |
| Care & privacy | Human handoff, third-party consent, export/delete            | `POST /api/users/handoff`, consent, export/delete              |
| Emergency lock | Call help, share location, nearest ER                        | `POST /api/users/location`, `PATCH /api/users/reset-emergency` |

Consent is enforced server-side: text needs `data_collection`; voice needs `data_collection` + `voice_recording`.

## Env

| Variable               | Purpose                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | NestJS base. Browser calls **`/api-proxy`** (same-origin rewrite) so HttpOnly cookies work. |
| `NEXT_PUBLIC_USE_MOCK` | `0` = real triage/dashboard (default for deploy). `1` = mock triage only; auth still real.  |

**Never commit `.env.local`.** Commit `.env.local.example` only.

### Ngrok checklist

1. Set `NEXT_PUBLIC_API_URL=https://your-subdomain.ngrok-free.app` in `.env.local`
2. Backend `.env`: `FRONTEND_ORIGIN=http://localhost:3001` (exact match)
3. Restart frontend dev server
4. Open http://localhost:3001/login → register / sign in → accept consent → talk

## Deploy (Vercel frontend + hosted NestJS)

Keep the `/api-proxy` rewrite so cookies stay on the Vercel host.

1. **Vercel project**
   - Root directory: `Frontend`
   - Env:
     - `NEXT_PUBLIC_API_URL=https://<your-api-host>` (no trailing slash)
     - `NEXT_PUBLIC_USE_MOCK=0`
   - Build command: `npm run build` (default)
   - Redeploy after changing env (Next embeds rewrite target at build time)

2. **NestJS backend**
   - `FRONTEND_ORIGIN=https://<your-vercel-domain>` (exact, no trailing slash)
   - HTTPS + `COOKIE_SECURE=true` (or production mode) so cookies use `SameSite=None; Secure`
   - CORS credentials allowed for that origin (defense in depth even with proxy)

3. **Smoke test after deploy**
   - Register / login
   - Accept consent
   - Text + voice triage turn
   - History load + feedback flag
   - Human handoff
   - Emergency → share location → nearest ER → dismiss
   - Export / delete / logout

### What changes for deploy vs local

| Setting                   | Local                      | Production                |
| ------------------------- | -------------------------- | ------------------------- |
| `NEXT_PUBLIC_API_URL`     | `localhost:3000` or ngrok  | Hosted API HTTPS URL      |
| `NEXT_PUBLIC_USE_MOCK`    | `0` (or `1` for UI-only)   | **`0` always**            |
| Backend `FRONTEND_ORIGIN` | `http://localhost:3001`    | `https://<vercel-domain>` |
| Cookies                   | Lax / HTTP OK on localhost | Secure + SameSite=None    |

## Stack

| Piece     | Choice                                           |
| --------- | ------------------------------------------------ |
| Framework | Next.js App Router                               |
| State     | Zustand (`store/aura.store.ts`)                  |
| Charts    | Recharts                                         |
| Voice in  | Web Speech API Push-to-Talk (Chrome/Edge, HTTPS) |
| Voice out | Backend `audio_base64` via `lib/audio.ts`        |
| Styling   | Tailwind CSS                                     |

See [frontend.md](./frontend.md) for the original UI contract notes. Prefer this README + `Backend/api_documentation.md` for current API shapes.
