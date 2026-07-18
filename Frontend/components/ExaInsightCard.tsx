"use client";

import { useAuraStore } from "@/store/aura.store";

/** Research insight card. Hidden unless third-party sharing consent is granted. */
export function ExaInsightCard() {
  const exa = useAuraStore((s) => s.currentExa);
  const allowed = useAuraStore((s) => s.consents.third_party_sharing === true);
  const grantConsents = useAuraStore((s) => s.grantConsents);

  if (!exa) return null;

  if (!allowed) {
    return (
      <div
        style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
        className="aura-panel aura-transition rounded-3xl p-5 shadow-sm"
      >
        <p className="text-[10px] font-semibold tracking-[0.18em] text-aura-accent uppercase">
          Research available
        </p>
        <p className="mt-2 text-sm text-aura-muted">
          Aura found a related insight. Enable third-party sharing to view it.
        </p>
        <button
          type="button"
          onClick={() => void grantConsents(["third_party_sharing"])}
          className="mt-3 rounded-full bg-aura-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Enable & show insight
        </button>
      </div>
    );
  }

  return (
    <a
      href={exa.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
      className="aura-panel aura-transition group block rounded-3xl p-5 shadow-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2">
        <SparkIcon />
        <span className="text-[10px] font-semibold tracking-[0.18em] text-aura-accent uppercase">
          Researched for you
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-aura-ink group-hover:underline">
        {exa.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-aura-muted">{exa.summary}</p>

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-aura-accent">
        Read source
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </span>
    </a>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-aura-accent" fill="currentColor">
      <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2z" />
    </svg>
  );
}
