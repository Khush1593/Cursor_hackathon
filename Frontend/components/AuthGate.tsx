"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuraStore } from "@/store/aura.store";

/**
 * Guards the dashboard. Restores cookie session via GET /api/auth/me
 * (with automatic refresh on 401 inside lib/api). Redirects to /login if none.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authStatus = useAuraStore((s) => s.authStatus);
  const restoreSession = useAuraStore((s) => s.restoreSession);
  const bootstrapDashboard = useAuraStore((s) => s.bootstrapDashboard);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = authStatus === "authenticated" ? true : await restoreSession();
      if (cancelled) return;
      if (!ok) {
        router.replace("/login");
        return;
      }
      await bootstrapDashboard();
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally once on mount — store actions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div
        data-tier="preventive"
        className="flex min-h-screen flex-col items-center justify-center gap-3"
      >
        <span
          className="h-12 w-12 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--aura-accent) 80%, white), var(--aura-accent))",
            animation: "orb-pulse 2s ease-in-out infinite",
          }}
        />
        <p className="text-sm text-aura-muted">Restoring your session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
