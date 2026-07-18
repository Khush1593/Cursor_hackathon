"use client";

import { useAuraStore } from "@/store/aura.store";

/**
 * Explainability panel — surfaces the backend's `reasoning_trace` so the
 * triage decision isn't a black box. Hidden when there's nothing to show.
 */
export function ReasoningPanel() {
  const reasoning = useAuraStore((s) => s.reasoning);
  if (!reasoning || reasoning.length === 0) return null;

  return (
    <section
      style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
      className="aura-panel aura-transition rounded-3xl p-5 shadow-sm"
    >
      <header className="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-aura-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
        </svg>
        <h2 className="text-xs font-semibold tracking-[0.18em] text-aura-muted uppercase">
          Why Aura said this
        </h2>
      </header>

      <ol className="mt-3 flex flex-col gap-2">
        {reasoning.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-aura-ink">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aura-accent-soft text-[11px] font-semibold text-aura-accent">
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
