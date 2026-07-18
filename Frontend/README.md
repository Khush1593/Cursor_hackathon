# Aura Frontend

Voice-first adaptive UI for **Aura** — Next.js (App Router) + Zustand + Tailwind + Recharts.

Runs on **http://localhost:3001**. Talks only to the NestJS backend at `NEXT_PUBLIC_API_URL` (or local mock when `NEXT_PUBLIC_USE_MOCK=1`).

## Quick start

```bash
cd Frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Stack

| Piece | Choice |
|-------|--------|
| Framework | Next.js App Router |
| State | Zustand (`store/aura.store.ts`) |
| Charts | Recharts (`MetricsChart`) |
| Voice in | Web Speech API Push-to-Talk |
| Voice out | Backend `audio_base64` via `lib/audio.ts` |
| Styling | Tailwind CSS |

## Folder map

```
Frontend/
├── app/page.tsx                 # single-screen experience
├── app/api/mock/[...route]/    # local mock when USE_MOCK=1
├── store/aura.store.ts
├── lib/api.ts                   # dashboard / triage / reset-emergency
├── lib/audio.ts
├── hooks/usePushToTalk.ts
└── components/                  # layout, PTT, chart, overlay, lock, insight
```

See [frontend.md](./frontend.md) for the frozen contract and Definition of Done.

## Env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | NestJS base URL (`http://localhost:3000` locally) |
| `NEXT_PUBLIC_DEMO_USER_ID` | Seeded demo user UUID |
| `NEXT_PUBLIC_USE_MOCK` | `1` = mock routes, `0` = real backend |
