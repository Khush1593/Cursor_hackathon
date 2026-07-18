/**
 * Aura Zustand store — shape locked to Frontend/frontend.md §7.
 * Actions (bootstrap, sendTurn, applyResponse, resetEmergency) land in API integration.
 */

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

export interface AuraState {
  userId: string;
  user: {
    age: number;
    sex: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  } | null;
  mode: Tier;
  isEmergency: boolean;
  messages: Msg[];
  metrics: Point[];
  currentExa: Exa;
  isRecording: boolean;
  isProcessing: boolean;
}
