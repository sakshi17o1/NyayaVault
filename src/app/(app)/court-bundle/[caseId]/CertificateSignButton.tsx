"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileSignature } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";

export function CertificateSignButton({ caseId, disabled }: { caseId: string, disabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/certificate`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to generate certificate");
        setLoading(false);
        return;
      }
      
      toast.success("Section 63 Draft Certificate Generated & Anchored to Ledger");
      router.refresh();
      setLoading(false);
    } catch (err) {
      toast.error("Failed to generate certificate");
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSign} 
      disabled={disabled || loading} 
      className="bg-green-700 hover:bg-green-800 text-white"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSignature className="w-4 h-4 mr-2" />}
      {loading ? "Generating Draft..." : "Generate Section 63 Draft"}
    </Button>
  );
}
