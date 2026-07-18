import type { Tier } from "@/store/aura.store";

/** Human-facing copy + status label for each severity tier. */
export const TIER_META: Record<
  Tier,
  { label: string; status: string; description: string }
> = {
  preventive: {
    label: "Preventive",
    status: "All calm",
    description: "Tracking your wellbeing. Nothing urgent right now.",
  },
  urgent_care: {
    label: "Urgent care",
    status: "Worth a check",
    description: "This may need a doctor soon — not an emergency.",
  },
  emergency: {
    label: "Emergency",
    status: "Act now",
    description: "Potentially life-threatening. Seek help immediately.",
  },
};

/** Accent color per tier (kept in sync with the CSS variables in globals.css). */
export const TIER_ACCENT: Record<Tier, string> = {
  preventive: "#2563eb",
  urgent_care: "#d97706",
  emergency: "#ef4444",
};
