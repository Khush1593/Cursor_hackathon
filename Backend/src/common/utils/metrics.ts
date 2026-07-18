/**
 * Lightweight pain/sleep extraction from free-text transcripts.
 * Fills the 7-day chart when the LLM returns empty extracted_dashboard_metrics.
 * Never invents PHI — only maps spoken numbers / clear severity words.
 */

const PAIN_NUM =
  /(?:pain(?:\s*(?:level|score|is|of|at|:))?\s*(?:a\s*|about\s*)?|hurts?\s*(?:like\s*|a\s*)?)(\d{1,2})(?:\s*\/\s*10)?/i;
const PAIN_SLASH = /(\d{1,2})\s*\/\s*10/;
const SLEEP_NUM =
  /(?:slept|sleep(?:ing|s)?|sleep\s*hours?)\D{0,16}(\d{1,2}(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)?/i;
const SLEEP_HOURS_OF =
  /(\d{1,2}(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\s*(?:of\s+)?(?:sleep|rest)/i;

function clampInt(n: number, min: number, max: number): number | null {
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/** Coerce JSON number or numeric string → finite number, else null. */
export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function inferMetricsFromTranscript(transcript: string): {
  pain_level?: number;
  sleep_hours?: number;
} {
  const t = (transcript ?? '').toLowerCase();
  const out: { pain_level?: number; sleep_hours?: number } = {};

  const painMatch = t.match(PAIN_NUM) ?? t.match(PAIN_SLASH);
  if (painMatch) {
    const n = clampInt(Number(painMatch[1]), 1, 10);
    if (n != null) out.pain_level = n;
  } else if (
    /\b(severe|worst|unbearable|excruciating)\b[\w\s]{0,20}\b(pain|ache|migraine)\b/.test(
      t,
    ) ||
    /\b(pain|ache|migraine)\b[\w\s]{0,20}\b(severe|worst|unbearable)\b/.test(t)
  ) {
    out.pain_level = 8;
  } else if (
    /\b(moderate|bad|strong)\b[\w\s]{0,20}\b(pain|ache|migraine)\b/.test(t) ||
    /\b(pain|ache|migraine)\b[\w\s]{0,20}\b(moderate|bad)\b/.test(t)
  ) {
    out.pain_level = 5;
  } else if (
    /\b(mild|slight|little|small)\b[\w\s]{0,20}\b(pain|ache)\b/.test(t) ||
    /\b(pain|ache)\b[\w\s]{0,20}\b(mild|slight)\b/.test(t)
  ) {
    out.pain_level = 3;
  } else if (/\b(pain|ache|hurts?|migraine|headache)\b/.test(t)) {
    out.pain_level = 5;
  }

  const sleepMatch = t.match(SLEEP_NUM) ?? t.match(SLEEP_HOURS_OF);
  if (sleepMatch) {
    const n = clampInt(Number(sleepMatch[1]), 0, 24);
    if (n != null) out.sleep_hours = n;
  } else if (
    /slept\s+poorly|poor\s+sleep|bad\s+sleep|couldn't\s+sleep|could not sleep|insomnia|barely\s+slept|no\s+sleep/.test(
      t,
    )
  ) {
    out.sleep_hours = 4;
  } else if (/slept\s+(well|great|good)|good\s+sleep|slept\s+fine/.test(t)) {
    out.sleep_hours = 8;
  } else if (/\b(sleep|slept|sleeping)\b/.test(t)) {
    out.sleep_hours = 6;
  }

  return out;
}
