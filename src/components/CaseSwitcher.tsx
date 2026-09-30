"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Folder } from "lucide-react";

type CaseInfo = {
  id: string;
  caseNumber: string;
  title: string;
};

export function CaseSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases/assigned")
      .then((res) => (res.ok ? res.json() : { cases: [] }))
      .then((data) => {
        setCases(data.cases || []);
        setLoading(false);
      })
      .catch(() => {
        setCases([]);
        setLoading(false);
      });
  }, []);

  let currentCaseId = searchParams.get("caseId") || "";
  if (!currentCaseId && pathname.startsWith("/cases/") && pathname.split("/").length > 2) {
    currentCaseId = pathname.split("/")[2];
  }

  return (
    <div className="hidden lg:flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-1.5 rounded-full shadow-sm">
      <Folder className="h-4 w-4 text-slate-500" />
      <select
        aria-label="Switch active case"
        disabled={loading || cases.length === 0}
        className="appearance-none bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-4"
        value={currentCaseId}
        onChange={(e) => {
          const val = e.target.value;
          const rootPath = pathname.split("/")[1];
          const keepOnPagePaths = ["integrity", "upload", "custody", "audit", "share"];
          
          if (keepOnPagePaths.includes(rootPath)) {
            router.push(`${pathname}${val ? `?caseId=${val}` : ''}`);
          } else if (val) {
            router.push(`/cases/${val}`);
          } else {
            router.push(`/cases`);
          }
        }}
      >
        <option value="">
          {pathname === "/cases" ? "All assigned cases" : "Current workspace"}
        </option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.caseNumber}
          </option>
        ))}
      </select>
    </div>
  );
}
