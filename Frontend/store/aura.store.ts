"use client";

/**
 * Aura Zustand store — shape locked to Frontend/frontend.md §7.
 *
 * Components read from this store ONLY. `applyResponse()` is the single place
 * that maps a backend turn response onto UI state, so the whole app reacts to
 * one function.
 *
 * During the design phase `sendTurn()` resolves against local keyword mocks
 * (matching frontend.md §9). On integration day it is swapped for real fetch
 * calls in lib/api.ts — the store shape and applyResponse() stay identical.
 */

import { create } from "zustand";

export type Tier = "preventive" | "urgent_care" | "emergency";

export type ActionType =
  "ask_follow_up" | "resolve" | "emergency_escalation" | "general_response";

export type Msg = {
  role: "user" | "aura";
  text: string;
  createdAt: string;
};

export type Point = {
  date: string;
  pain_level: number | null;
  sleep_hours: number | null;
};

export type Exa = {
  title: string;
  url: string;
  summary: string;
} | null;

export type User = {
  age: number;
  sex: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

/** The frozen POST /api/triage/turn response shape (frontend.md §5). */
export type TurnResponse = {
  action_type: ActionType;
  detected_mode: Tier;
  ai_spoken_response: string;
  audio_base64: string | null;
  is_emergency_state: boolean;
  updated_metrics: { pain_level: number | null; sleep_hours: number | null } | null;
  exa_insight: Exa;
};

export interface AuraState {
  userId: string;
  user: User | null;
  mode: Tier;
  isEmergency: boolean;
  messages: Msg[];
  metrics: Point[];
  currentExa: Exa;
  isRecording: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  booted: boolean;

  // actions
  bootstrap: () => void;
  setRecording: (v: boolean) => void;
  setLiveTranscript: (t: string) => void;
  sendTurn: (transcript: string) => Promise<void>;
  applyResponse: (res: TurnResponse) => void;
  resetEmergency: () => void;
}

/* ------------------------------------------------------------------ */
/*  Seed data (stands in for GET /dashboard during design)            */
/* ------------------------------------------------------------------ */

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const SEED_METRICS: Point[] = [
  { date: isoDaysAgo(6), pain_level: 6, sleep_hours: 5 },
  { date: isoDaysAgo(5), pain_level: 5, sleep_hours: 6 },
  { date: isoDaysAgo(4), pain_level: 5, sleep_hours: 5.5 },
  { date: isoDaysAgo(3), pain_level: 4, sleep_hours: 7 },
  { date: isoDaysAgo(2), pain_level: 4, sleep_hours: 6.5 },
  { date: isoDaysAgo(1), pain_level: 3, sleep_hours: 7.5 },
  { date: isoDaysAgo(0), pain_level: 3, sleep_hours: 7 },
];

const SEED_MESSAGES: Msg[] = [
  {
    role: "aura",
    text: "Good to see you. Hold the orb and tell me how you're feeling today.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Local mock turn engine (design only — mirrors frontend.md §9)     */
/* ------------------------------------------------------------------ */

function mockTurn(transcript: string): TurnResponse {
  const t = transcript.toLowerCase();

  if (t.includes("chest")) {
    return {
      action_type: "emergency_escalation",
      detected_mode: "emergency",
      ai_spoken_response:
        "This could be serious. I'm escalating now — please call emergency services or use the button below.",
      audio_base64: null,
      is_emergency_state: true,
      updated_metrics: { pain_level: 9, sleep_hours: null },
      exa_insight: null,
    };
  }

  if (t.includes("headache") || t.includes("head")) {
    return {
      action_type: "ask_follow_up",
      detected_mode: "urgent_care",
      ai_spoken_response:
        "I hear you. Is the headache sudden and the worst you've ever had, or does it come with a stiff neck or vision changes?",
      audio_base64: null,
      is_emergency_state: false,
      updated_metrics: { pain_level: 6, sleep_hours: null },
      exa_insight: null,
    };
  }

  if (t.includes("sleep") || t.includes("tired") || t.includes("slept")) {
    return {
      action_type: "resolve",
      detected_mode: "preventive",
      ai_spoken_response:
        "Thanks for logging that. Your sleep has been trending up this week — keep a consistent wind-down routine and we'll keep watching it together.",
      audio_base64: null,
      is_emergency_state: false,
      updated_metrics: { pain_level: null, sleep_hours: 6 },
      exa_insight: {
        title: "Sleep hygiene: evidence-based tips for better rest",
        url: "https://www.sleepfoundation.org/sleep-hygiene",
        summary:
          "Consistent sleep and wake times, a cool dark room, and limiting screens before bed measurably improve sleep quality over a few weeks.",
      },
    };
  }

  return {
    action_type: "general_response",
    detected_mode: "preventive",
    ai_spoken_response:
      "Glad you're checking in. I'm here whenever something feels off — just hold the orb and talk.",
    audio_base64: null,
    is_emergency_state: false,
    updated_metrics: null,
    exa_insight: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useAuraStore = create<AuraState>((set, get) => ({
  userId: process.env.NEXT_PUBLIC_DEMO_USER_ID ?? "demo-user",
  user: null,
  mode: "preventive",
  isEmergency: false,
  messages: [],
  metrics: [],
  currentExa: null,
  isRecording: false,
  isProcessing: false,
  liveTranscript: "",
  booted: false,

  bootstrap: () => {
    if (get().booted) return;
    set({
      booted: true,
      user: {
        age: 34,
        sex: "female",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "+1-555-0100",
      },
      mode: "preventive",
      isEmergency: false,
      metrics: SEED_METRICS,
      messages: SEED_MESSAGES,
      currentExa: null,
    });
  },

  setRecording: (v) => set({ isRecording: v }),
  setLiveTranscript: (t) => set({ liveTranscript: t }),

  sendTurn: async (transcript) => {
    const clean = transcript.trim();
    if (!clean) return;

    const now = new Date().toISOString();
    set((s) => ({
      messages: [...s.messages, { role: "user", text: clean, createdAt: now }],
      isProcessing: true,
      liveTranscript: "",
    }));

    // Design-phase latency + local mock. Swapped for lib/api.ts on integration.
    await new Promise((r) => setTimeout(r, 700));
    const res = mockTurn(clean);
    get().applyResponse(res);
    set({ isProcessing: false });
  },

  applyResponse: (res) => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    set((s) => {
      // merge today's metrics point, ignoring null values (don't plot nulls)
      let metrics = s.metrics;
      if (res.updated_metrics) {
        const { pain_level, sleep_hours } = res.updated_metrics;
        const idx = metrics.findIndex((p) => p.date === today);
        const base: Point =
          idx >= 0 ? metrics[idx] : { date: today, pain_level: null, sleep_hours: null };
        const merged: Point = {
          date: today,
          pain_level: pain_level ?? base.pain_level,
          sleep_hours: sleep_hours ?? base.sleep_hours,
        };
        metrics =
          idx >= 0
            ? metrics.map((p, i) => (i === idx ? merged : p))
            : [...metrics, merged];
      }

      return {
        mode: res.detected_mode,
        isEmergency: res.is_emergency_state,
        messages: [
          ...s.messages,
          { role: "aura", text: res.ai_spoken_response, createdAt: now },
        ],
        metrics,
        currentExa: res.exa_insight ?? s.currentExa,
      };
    });
  },

  resetEmergency: () => {
    // On integration this calls PATCH /api/users/reset-emergency.
    set({ isEmergency: false, mode: "preventive" });
  },
}));
