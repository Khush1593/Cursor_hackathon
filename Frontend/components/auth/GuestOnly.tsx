"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuraStore } from "@/store/aura.store";

/** If a cookie session already exists, skip login/register and go to the dashboard. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authStatus = useAuraStore((s) => s.authStatus);
  const restoreSession = useAuraStore((s) => s.restoreSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authStatus === "authenticated") {
        router.replace("/");
        return;
      }
      const ok = await restoreSession();
      if (!cancelled && ok) router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
