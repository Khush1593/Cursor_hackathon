# 🎨 Frontend Developer Playbook — The Adaptive UI (Next.js + Zustand)

> **You own:** everything the user sees and hears. Voice capture (Push-to-Talk), the state-driven
> dashboard, the 3-tier theme, the conversation overlay, audio playback, and the emergency lock.
> You talk to exactly ONE thing: the backend at `NEXT_PUBLIC_API_URL`. You never call the AI,
> ElevenLabs, or Exa directly. **Source of truth for contracts:** [contracts_v5.md](contracts_v5.md).

---

## 1. Your mission in one sentence
Capture the user's voice on button-release, POST it to the backend, then re-render the entire app
(theme, chart, conversation, insight card, emergency lock) purely from the JSON the backend returns.

## 2. Stack & port
- **Next.js (App Router) + Zustand + Tailwind + Recharts**, runs on **`:3001`**.
- **Voice in:** browser-native **Web Speech API** (`window.SpeechRecognition`), Push-to-Talk.
- **Voice out:** play the backend's `audio_base64` via a pre-unlocked global `Audio` object.
- **Hosting:** Vercel (auto-HTTPS — required for the mic).

## 3. Environment (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3000        # the Railway HTTPS URL in prod
NEXT_PUBLIC_DEMO_USER_ID=<the seeded user uuid>  # must match backend seed
NEXT_PUBLIC_USE_MOCK=1                            # 1 = use local mock, 0 = hit real backend
```

## 4. Folder structure to create
```
frontend/
├── app/
│   ├── page.tsx                    # the whole single-screen experience
│   └── api/mock/[...route]/route.ts# local mock backend (see §9) when USE_MOCK=1
├── store/aura.store.ts             # Zustand global state (§7)
├── lib/api.ts                      # the 3 backend calls (§5)
├── lib/audio.ts                    # unlock() + play(base64)
├── hooks/usePushToTalk.ts          # Web Speech + unlock on mousedown
└── components/
    ├── DashboardLayout.tsx         # 3-tier theme wrapper + disclaimer
    ├── PushToTalkButton.tsx
    ├── ConversationOverlay.tsx     # last 3 messages, right side
    ├── MetricsChart.tsx            # Recharts 7-day line: pain_level + sleep_hours
    ├── ExaInsightCard.tsx          # {title, url, summary}
    └── EmergencyLock.tsx           # red full-screen + 911 + contacts + Dismiss
```

---

## 5. 🔒 THE FROZEN CONTRACT (your ONLY seam — the backend)

All three calls go to `NEXT_PUBLIC_API_URL`. **You are the client. Never guess field names.**

### On mount → `GET /api/users/:userId/dashboard`
```json
{
  "user": { "id":"uuid", "age":34, "sex":"female",
            "activeMode":"preventive", "isEmergencyState":false,
            "emergencyContactName":"Jane Doe", "emergencyContactPhone":"+1-555-0100" },
  "metricsHistory": [ { "date":"2026-07-13", "pain_level":5, "sleep_hours":6 } ],
  "recentMessages": [ { "role":"user", "text":"I slept badly", "createdAt":"2026-07-16T22:10:00Z" } ]
}
```
Use this to seed the store: theme from `user.activeMode`, chart from `metricsHistory`, overlay from `recentMessages`, lock from `user.isEmergencyState`.

### On button release → `POST /api/triage/turn`
```json
// REQUEST you send
{ "userId": "<NEXT_PUBLIC_DEMO_USER_ID>", "transcript": "My chest hurts" }

// RESPONSE you receive — drive the WHOLE UI from this
{
  "action_type": "ask_follow_up",
  "detected_mode": "urgent_care",
  "ai_spoken_response": "Are you experiencing any crushing chest pressure?",
  "audio_base64": "UklGRiQ...",           // may be null → just show text, no audio
  "is_emergency_state": false,
  "updated_metrics": { "pain_level": 4, "sleep_hours": null },
  "exa_insight": null                       // {title,url,summary} only when action_type "resolve"
}
```

### On "Crisis Handled / Dismiss" → `PATCH /api/users/reset-emergency`
```json
// REQUEST { "userId": "<id>" }
// RESPONSE { "is_emergency_state": false, "active_mode": "preventive" }
```

### How each response field maps to UI
| Field | What you do |
|---|---|
| `detected_mode` | set the theme: `preventive`→blue, `urgent_care`→amber, `emergency`→red |
| `is_emergency_state: true` | render `<EmergencyLock/>` over everything (911 + contacts + Dismiss) |
| `ai_spoken_response` | push an "aura" bubble into the conversation overlay |
| `audio_base64` | `audio.play(base64)` — if `null`, skip silently (text already shown) |
| `updated_metrics` | merge today's point into the chart (ignore `null` values; don't plot them) |
| `exa_insight` | if not null, render `<ExaInsightCard/>` below the conversation |
| `action_type: "ask_follow_up"` | keep the mic prominent — Aura is waiting for the user's answer |

## 6. The 3-tier theme (Tailwind)
| `detected_mode` | Look | Classes (example) |
|---|---|---|
| `preventive` | calm blue/green | `bg-blue-50 text-blue-900` |
| `urgent_care` | amber, non-locking | `bg-amber-100 text-amber-900` |
| `emergency` | high-contrast red + LOCK | `bg-red-600 text-white` + `<EmergencyLock/>` |

A **persistent medical disclaimer** ("Aura is not a medical device and does not diagnose") must be visible in every tier.

## 7. Zustand store shape (`aura.store.ts`)
```typescript
type Tier = "preventive" | "urgent_care" | "emergency";
type Msg  = { role: "user" | "aura"; text: string; createdAt: string };
type Point = { date: string; pain_level: number | null; sleep_hours: number | null };
type Exa  = { title: string; url: string; summary: string } | null;

interface AuraState {
  userId: string;
  user: { age: number; sex: string; emergencyContactName?: string; emergencyContactPhone?: string } | null;
  mode: Tier;                 // drives theme
  isEmergency: boolean;       // drives the lock
  messages: Msg[];            // overlay shows last 3
  metrics: Point[];           // Recharts data
  currentExa: Exa;
  isRecording: boolean;
  isProcessing: boolean;      // spinner while awaiting backend
  // actions: bootstrap(), sendTurn(transcript), applyResponse(res), resetEmergency()
}
```
**Rule: components read from the store only.** `applyResponse()` is the single place that maps a
backend response onto state — so the whole UI reacts to one function.

## 8. Voice + audio (the two Chrome gotchas)
- **Push-to-Talk, no silence detection.** On `mousedown`/`touchstart`: (a) **unlock audio** — play+pause
  a 1-frame silent base64 clip on the global `Audio` (valid user gesture); (b) `recognition.start()`.
  On release: `recognition.stop()`, take the final transcript, call `sendTurn()`.
- **Audio unlock pattern** (`lib/audio.ts`): keep ONE module-level `Audio`. Unlock it on the first
  button press; later set `audio.src = "data:audio/mp3;base64,"+res.audio_base64` and
  `audio.play().catch(err => console.warn("autoplay blocked, text-only", err))`. **Always `.catch()`.**
- Web Speech API works in **Chrome/Edge**, needs **HTTPS or localhost**, and needs a live connection.

## 9. 🧪 Build WITHOUT the backend (you're independent)
Set `NEXT_PUBLIC_USE_MOCK=1` and point `lib/api.ts` at local Next.js Route Handlers under
`app/api/mock/...` that return canned responses **matching §5 exactly**. Provide one canned response
per branch so you can build every UI state before the backend exists:

| Trigger word in transcript | Mock returns (`detected_mode` / `action_type`) | UI you verify |
|---|---|---|
| "chest" | `emergency` / `emergency_escalation`, `is_emergency_state:true` | red lock + 911 |
| "headache" | `urgent_care` / `ask_follow_up` | amber theme, follow-up prompt |
| "sleep" | `preventive` / `resolve`, `updated_metrics:{sleep_hours:6}`, `exa_insight:{...}` | chart update + insight card |
| anything else | `preventive` / `general_response` | calm, no log, spoken reply only |

Flip `NEXT_PUBLIC_USE_MOCK=0` on integration day — zero code change, same shapes.

## 10. Definition of Done
- [ ] App boots from `GET /dashboard`: theme, chart, overlay, lock all reflect server state.
- [ ] Push-to-Talk captures speech and posts the transcript on release.
- [ ] Every `detected_mode` renders the correct theme; `emergency` shows the full-screen lock.
- [ ] `audio_base64` plays; `null` degrades to text with no error (`.catch` present).
- [ ] Chart plots `pain_level` + `sleep_hours` over 7 days; nulls are skipped, not zeroed.
- [ ] `exa_insight` card renders on `resolve` and hides otherwise.
- [ ] Dismiss button calls reset and returns the app to blue.
- [ ] Works end-to-end against the mock; flips to the real backend with one env change.

## 11. ⚠️ Golden rules
- **The backend response is the single source of truth for UI state.** Don't infer emergency from
  the transcript yourself — read `is_emergency_state`.
- **Never call AI/ElevenLabs/Exa directly** — everything comes through the backend.
- **Metric keys are `pain_level` and `sleep_hours`** — the chart reads exactly these.
- **Field names frozen.** Need a new field? Update [contracts_v5.md](contracts_v5.md) and tell the backend dev first.
