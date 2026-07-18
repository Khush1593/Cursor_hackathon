"use client";

import { AccountMenu } from "@/components/AccountMenu";
import { type DashboardTab, useAuraStore } from "@/store/aura.store";
import { TIER_META } from "@/lib/theme";

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "care", label: "Care & privacy" },
];

/** Top bar: Aura wordmark, module tabs, live tier, account menu. */
export function AuraHeader() {
  const mode = useAuraStore((s) => s.mode);
  const user = useAuraStore((s) => s.user);
  const activeTab = useAuraStore((s) => s.activeTab);
  const setActiveTab = useAuraStore((s) => s.setActiveTab);
  const meta = TIER_META[mode];

  return (
    <header className="flex flex-col gap-4 px-6 pt-6 sm:px-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--aura-accent) 80%, white), var(--aura-accent))",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2z" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight text-aura-ink">Aura</p>
            <p className="text-[11px] tracking-wide text-aura-muted">Health guardian</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="aura-panel aura-transition flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-aura-ink">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: "var(--aura-accent)",
                animation: "breathe 3s ease-in-out infinite",
              }}
            />
            {meta.label} · {meta.status}
          </span>

          {user && (
            <span className="hidden max-w-[10rem] truncate rounded-full bg-aura-accent-soft px-3 py-1.5 text-xs font-medium text-aura-ink sm:inline">
              {user.email ?? `${user.age} · ${user.sex}`}
            </span>
          )}

          <AccountMenu />
        </div>
      </div>

      <nav
        aria-label="Dashboard modules"
        className="aura-panel mx-auto flex w-full max-w-md gap-1 rounded-full p-1"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex-1 rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm",
                active
                  ? "bg-aura-accent text-white shadow-sm"
                  : "text-aura-muted hover:text-aura-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
