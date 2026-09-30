"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { Check } from "lucide-react";

export function ApproveSummaryButton({ caseId, summaryId }: { caseId: string, summaryId: string }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/summary/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId })
      });
      if (res.ok) {
        toast.success("AI summary verified and set as official!");
        window.location.reload();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to approve summary");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleApprove} 
      disabled={loading}
      className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
    >
      <Check className="h-3 w-3 mr-1" />
      {loading ? "Verifying..." : "Verify & Make Official"}
    </Button>
  );
}
