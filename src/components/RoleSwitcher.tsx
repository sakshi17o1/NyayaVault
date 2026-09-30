"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

type DemoUser = { id: string; email: string; name: string; role: Role; station: string | null };

export function RoleSwitcher({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/demo-users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  async function onChange(userId: string) {
    if (!userId) return;
    setBusy(true);
    await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    window.location.href = "/dashboard";
  }

  const current = users.find((u) => u.email === currentEmail);

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500 font-bold">
      <span className="hidden sm:inline">Present as</span>
      <select
        aria-label="Switch demo role"
        disabled={busy || users.length === 0}
        className="max-w-[16rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-[#0F294D] font-bold"
        value={current?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {users.length === 0 ? <option>Loading accounts…</option> : null}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.role} — {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
