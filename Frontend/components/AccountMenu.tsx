"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApiError, deleteUserData, exportUserData } from "@/lib/api";
import { useAuraStore } from "@/store/aura.store";

/** Account & privacy menu: export data, delete data, log out. */
export function AccountMenu() {
  const router = useRouter();
  const userId = useAuraStore((s) => s.userId);
  const user = useAuraStore((s) => s.user);
  const logout = useAuraStore((s) => s.logout);
  const clearHealthDataLocally = useAuraStore((s) => s.clearHealthDataLocally);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const onExport = async () => {
    if (!userId) return;
    setBusy("export");
    setNote(null);
    try {
      const data = await exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("Your data was exported.");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDeleteData = async () => {
    if (!userId) return;
    setBusy("delete");
    setNote(null);
    try {
      await deleteUserData(userId);
      clearHealthDataLocally();
      setNote("Your health data was deleted.");
      setConfirmDelete(false);
      setOpen(false);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  };

  const onLogout = async () => {
    setBusy("logout");
    await logout();
    router.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        title={user?.email ?? "Account"}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{ animation: "rise 0.25s ease both" }}
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_18px_50px_rgba(15,42,74,0.18)]"
        >
          {user?.email && (
            <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
          )}
          <MenuItem onClick={onExport} busy={busy === "export"} label="Export my data" />
          <MenuItem
            onClick={() => {
              setConfirmDelete(true);
              setOpen(false);
            }}
            busy={busy === "delete"}
            label="Delete my health data"
            danger
          />
          <div className="my-1 h-px bg-slate-200" />
          <MenuItem onClick={onLogout} busy={busy === "logout"} label="Log out" />
          {note && <p className="px-3 py-2 text-xs text-slate-500">{note}</p>}
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        danger
        title="Delete health data?"
        description="This permanently removes your health logs, insights, feedback, and handoff requests. Your account stays active. This cannot be undone."
        confirmLabel="Delete data"
        cancelLabel="Keep my data"
        busy={busy === "delete"}
        onCancel={() => {
          if (busy !== "delete") setConfirmDelete(false);
        }}
        onConfirm={() => void confirmDeleteData()}
      />
    </div>
  );
}

function MenuItem({
  onClick,
  label,
  busy,
  danger,
}: {
  onClick: () => void;
  label: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={busy}
      className={[
        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition disabled:opacity-50",
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-800 hover:bg-slate-100",
      ].join(" ")}
    >
      {label}
      {busy && <span className="animate-spin-slow text-xs">◌</span>}
    </button>
  );
}
