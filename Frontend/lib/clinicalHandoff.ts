/**
 * Build a clinician-facing handoff TEXT block from Aura store facts.
 * Not a diagnosis — structured context for EMTs / ER (hackathon demo).
 */

export type HandoffInput = {
  age?: number | null;
  sex?: string | null;
  chronicConditions?: string[];
  currentMeds?: string[];
  chiefComplaint?: string | null;
  aiSpoken?: string | null;
  reasoningTrace?: string[];
  metrics?: {
    date: string;
    pain_level: number | null;
    sleep_hours: number | null;
  }[];
};

function sexLabel(sex?: string | null): string {
  if (!sex) return "?";
  const s = sex.trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return sex.slice(0, 1).toUpperCase();
}

function formatBaseline(input: HandoffInput): string {
  const parts: string[] = [];
  const conditions = (input.chronicConditions ?? []).filter(Boolean);
  const meds = (input.currentMeds ?? []).filter(Boolean);
  if (conditions.length) parts.push(conditions.join(", "));
  if (meds.length) parts.push(meds.join(", "));
  return parts.length ? parts.join("; ") : "None recorded";
}

function formatDelta(metrics: HandoffInput["metrics"]): string {
  if (!metrics || metrics.length === 0) return "No recent vitals logged.";

  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const withPain = sorted.filter((p) => p.pain_level != null);
  const withSleep = sorted.filter((p) => p.sleep_hours != null);

  const bits: string[] = [];

  if (withPain.length >= 2) {
    const first = withPain[0].pain_level!;
    const last = withPain[withPain.length - 1].pain_level!;
    bits.push(`Pain ${first} → ${last} (1–10 scale)`);
  } else if (withPain.length === 1) {
    bits.push(`Latest pain ${withPain[0].pain_level}/10`);
  }

  if (withSleep.length >= 2) {
    const first = withSleep[0].sleep_hours!;
    const last = withSleep[withSleep.length - 1].sleep_hours!;
    const pct = first > 0 ? Math.round(((last - first) / first) * 100) : null;
    bits.push(
      pct != null
        ? `Sleep ${first}h → ${last}h (${pct > 0 ? "+" : ""}${pct}%)`
        : `Sleep ${first}h → ${last}h`,
    );
  } else if (withSleep.length === 1) {
    bits.push(`Latest sleep ${withSleep[0].sleep_hours}h`);
  }

  return bits.length ? bits.join(". ") + "." : "No recent vitals logged.";
}

/** Multi-line handoff card body for the emergency UI. */
export function buildClinicalHandoffText(input: HandoffInput): string {
  const age = input.age ?? "?";
  const sex = sexLabel(input.sex);
  const complaint = (input.chiefComplaint ?? "").trim() || "Not captured on this turn.";
  const triage =
    (input.aiSpoken ?? "").trim() || "Aura flagged a possible emergency — seek care now.";
  const why =
    (input.reasoningTrace ?? []).filter(Boolean).slice(0, 3).join(" | ") ||
    "Differential risk stratification triggered emergency mode.";

  return [
    `PATIENT: ${age}${sex}.`,
    `BASELINE: ${formatBaseline(input)}.`,
    `DELTA (7-day): ${formatDelta(input.metrics)}`,
    `CHIEF COMPLAINT: ${complaint}`,
    `AI TRIAGE (not a diagnosis): ${triage}`,
    `WHY: ${why}`,
  ].join("\n");
}

/** Short SMS-style preview for emergency contacts (demo — not sent). */
export function buildRelativeNotifyPreview(input: {
  contactName?: string | null;
  handoffSummary: string;
}): string {
  const who = input.contactName?.trim() || "your emergency contact";
  return (
    `Aura would notify ${who}:\n` +
    `"Possible medical emergency. Please check on me now. ` +
    `Handoff: ${input.handoffSummary.replace(/\n/g, " | ")}"`
  );
}
