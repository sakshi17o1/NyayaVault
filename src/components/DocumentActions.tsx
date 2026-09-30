"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { useToast } from "@/components/ui/ToastProvider";

export function DocumentActions({ docId }: { docId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to attempt deleting this document?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.status === "LEGAL_HOLD_ACTIVE") {
          toast.error(`BLOCKED: ${data.error}`);
        } else {
          toast.error(`ERROR: ${data.error}`);
        }
      } else {
        toast.success("Document archived successfully.");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a 
        href={`/api/documents/${docId}/certificate`} 
        target="_blank"
        className="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
      >
        Section 63 Cert
      </a>
      <button 
        onClick={(e) => {
          e.preventDefault();
          const purpose = prompt("Enter purpose for access (Required for RESTRICTED and PROTECTED files):");
          if (purpose !== null) {
            let url = `/api/documents/${docId}/download`;
            if (purpose.trim()) {
              url += `?purpose=${encodeURIComponent(purpose.trim())}`;
            }
            window.open(url, "_blank");
          }
        }}
        className="rounded bg-slate-100 px-2 py-1 text-xs font-medium hover:bg-slate-200"
      >
        Download
      </button>
      <button 
        onClick={handleDelete}
        disabled={loading}
        className="rounded bg-red-50 text-red-600 px-2 py-1 text-xs font-medium border border-red-200 hover:bg-red-100 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
