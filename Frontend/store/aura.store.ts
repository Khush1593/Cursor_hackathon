"use client";

/**
 * Aura Zustand store — components read from here only.
 * Auth uses cookie sessions (lib/api.ts). Triage stays mock when USE_MOCK=1.
 */

import { create } from "zustand";
import {
  type AuthUser,
  type TurnResponse as ApiTurnResponse,
  fetchDashboard,
  getMe,
  logout as apiLogout,
  patchResetEmergency,
  postTriageTurn,
  isMockTriage,
} from "@/lib/api";
import { play } from "@/lib/audio";

export type Tier = "preventive" | "urgent_care" | "emergency";

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
  id?: string;
  email?: string;
  age: number;
  sex: string;
  chronicConditions?: string[];
  currentMeds?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type TurnResponse = ApiTurnResponse;

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export interface AuraState {
  authStatus: AuthStatus;
  userId: string;
  user: User | null;
  mode: Tier;
  isEmergency: boolean;
  /** Last turn's explainability bullets (for emergency handoff / ReasoningPanel). */
  lastReasoningTrace: string[];
  messages: Msg[];
  metrics: Point[];
  currentExa: Exa;
  isRecording: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  booted: boolean;

  hydrateFromAuthUser: (user: AuthUser) => void;
  clearSession: () => void;
  restoreSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  bootstrapDashboard: () => Promise<void>;
  setRecording: (v: boolean) => void;
  setLiveTranscript: (t: string) => void;
  sendTurn: (transcript: string) => Promise<void>;
  applyResponse: (res: TurnResponse) => void;
  resetEmergency: () => Promise<void>;
}

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

function mockTurn(transcript: string): TurnResponse {
  const t = transcript.toLowerCase();

  if (
    t.includes("droop") ||
    t.includes("slurred") ||
    (t.includes("face") && t.includes("numb"))
  ) {
    return {
      action_type: "emergency_escalation",
      detected_mode: "emergency",
      ai_spoken_response:
        "These signs can mean a stroke. Call emergency services now — every minute matters.",
      audio_base64: null,
      is_emergency_state: true,
      updated_metrics: null,
      exa_insight: null,
      reasoning_trace: [
        "Matched: stroke_tia (severity 10)",
        "Emergency bypass: empty secondary_symptoms_to_check",
      ],
    };
  }

  if (t.includes("chest")) {
    return {
      action_type: "emergency_escalation",
      detected_mode: "emergency",
      ai_spoken_response:
        "This could be a serious cardiac warning. I'm escalating now — please call emergency services or use the buttons below.",
      audio_base64: null,
      is_emergency_state: true,
      updated_metrics: { pain_level: 9, sleep_hours: null },
      exa_insight: null,
      reasoning_trace: [
        "Matched: acute cardiac pattern (high severity)",
        "Escalating to emergency care guidance",
      ],
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
      reasoning_trace: [
        "Matched headache pathway",
        "Checking secondary: sudden/worst/stiff neck/vision",
      ],
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
      reasoning_trace: ["Preventive sleep log — no emergency triggers"],
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
    reasoning_trace: ["No clinical triggers matched"],
  };
}

function toUser(u: AuthUser): User {
  return {
    id: u.id,
    email: u.email,
    age: u.age,
    sex: u.sex,
    chronicConditions: u.chronicConditions ?? [],
    currentMeds: u.currentMeds ?? [],
    emergencyContactName: u.emergencyContactName ?? undefined,
    emergencyContactPhone: u.emergencyContactPhone ?? undefined,
  };
}

export const useAuraStore = create<AuraState>((set, get) => ({
  authStatus: "unknown",
  userId: "",
  user: null,
  mode: "preventive",
  isEmergency: false,
  lastReasoningTrace: [],
  messages: [],
  metrics: [],
  currentExa: null,
  isRecording: false,
  isProcessing: false,
  liveTranscript: "",
  booted: false,

  hydrateFromAuthUser: (authUser) => {
    set({
      authStatus: "authenticated",
      userId: authUser.id,
      user: toUser(authUser),
      mode: authUser.activeMode,
      isEmergency: authUser.isEmergencyState,
      booted: false,
    });
  },

  clearSession: () => {
    set({
      authStatus: "unauthenticated",
      userId: "",
      user: null,
      mode: "preventive",
      isEmergency: false,
      lastReasoningTrace: [],
      messages: [],
      metrics: [],
      currentExa: null,
      booted: false,
      isRecording: false,
      isProcessing: false,
      liveTranscript: "",
    });
  },

  restoreSession: async () => {
    try {
      const me = await getMe();
      get().hydrateFromAuthUser(me);
      return true;
    } catch {
      get().clearSession();
      return false;
    }
  },

  logout: async () => {
    try {
      await apiLogout();
    } catch {
      /* still clear local session */
    }
    get().clearSession();
  },

  bootstrapDashboard: async () => {
    if (get().booted) return;
    const { userId, user } = get();

    if (isMockTriage()) {
      set({
        booted: true,
        metrics: SEED_METRICS,
        messages: SEED_MESSAGES,
        currentExa: null,
        mode: get().mode || "preventive",
        isEmergency: get().isEmergency,
      });
      return;
    }

    if (!userId) return;

    try {
      const dash = await fetchDashboard(userId);
      set({
        booted: true,
        mode: dash.user.activeMode,
        isEmergency: dash.user.isEmergencyState,
        user: {
          id: dash.user.id,
          email: user?.email,
          age: dash.user.age,
          sex: dash.user.sex,
          chronicConditions: user?.chronicConditions ?? [],
          currentMeds: user?.currentMeds ?? [],
          emergencyContactName: dash.user.emergencyContactName ?? undefined,
          emergencyContactPhone: dash.user.emergencyContactPhone ?? undefined,
        },
        metrics: dash.metricsHistory,
        messages: dash.recentMessages,
        currentExa: null,
      });
    } catch {
      // Backend dashboard not ready yet — fall back to seed so UI still works.
      set({
        booted: true,
        metrics: SEED_METRICS,
        messages: SEED_MESSAGES,
      });
    }
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

    try {
      let res: TurnResponse;
      if (isMockTriage()) {
        await new Promise((r) => setTimeout(r, 700));
        res = mockTurn(clean);
      } else {
        res = await postTriageTurn(get().userId, clean);
      }
      get().applyResponse(res);
      play(res.audio_base64);
    } catch {
      get().applyResponse({
        action_type: "general_response",
        detected_mode: get().mode,
        ai_spoken_response:
          "I couldn't reach the care service just now. Please try again in a moment.",
        audio_base64: null,
        is_emergency_state: get().isEmergency,
        updated_metrics: null,
        exa_insight: null,
        reasoning_trace: [],
      });
    } finally {
      set({ isProcessing: false });
    }
  },

  applyResponse: (res) => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    set((s) => {
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
        lastReasoningTrace: res.reasoning_trace ?? [],
        messages: [
          ...s.messages,
          { role: "aura", text: res.ai_spoken_response, createdAt: now },
        ],
        metrics,
        currentExa: res.exa_insight ?? s.currentExa,
      };
    });
  },

  resetEmergency: async () => {
    const { userId } = get();
    if (!isMockTriage() && userId) {
      try {
        const res = await patchResetEmergency(userId);
        set({
          isEmergency: res.is_emergency_state,
          mode: res.active_mode,
          lastReasoningTrace: [],
        });
        return;
      } catch {
        /* fall through to local reset */
      }
    }
    set({ isEmergency: false, mode: "preventive", lastReasoningTrace: [] });
  },
}));
