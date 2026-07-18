"use client";

import type { ReactNode } from "react";
import { useAuraStore } from "@/store/aura.store";

/**
 * 3-tier theme wrapper. Sets `data-tier` on the root so the entire palette
 * (defined as CSS variables in globals.css) transitions in one smooth step.
 * Also renders the persistent, always-visible medical disclaimer.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const mode = useAuraStore((s) => s.mode);

  return (
    <div
      data-tier={mode}
      className="aura-transition relative z-10 flex min-h-screen flex-col"
    >
      <div className="flex-1">{children}</div>

      <footer className="relative z-10 px-6 pb-4 pt-2">
        <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-aura-muted">
          Aura is not a medical device and does not diagnose. For any emergency, call your
          local emergency number immediately.
        </p>
      </footer>
    </div>
  );
}
