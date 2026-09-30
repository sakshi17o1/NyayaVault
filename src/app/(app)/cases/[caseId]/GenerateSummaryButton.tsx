"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Cpu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { useTransformersWorker } from "@/lib/ai/client";

export function GenerateSummaryButton({ caseId }: { caseId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { generate } = useTransformersWorker();

  const handleGenerate = async () => {
    setLoading(true);
    setAiSummary(null);
    try {
      // 1. Fetch raw context
      const contextRes = await fetch(`/api/cases/${caseId}/context`);
      const contextData = await contextRes.json();
      
      if (!contextData.context) {
        toast.error("No extractable text found in this case.");
        setLoading(false);
        return;
      }

      let safeContext = contextData.context;
      if (safeContext.length > 1500) {
        safeContext = safeContext.substring(0, 1500) + "\n...[TRUNCATED due to local model size limits]";
      }
      const prompt = `System: Summarize the following case briefly.\n\nContext:\n${safeContext}`;

      // 2. Generate summary fully offline via WebWorker
      generate(prompt, async (response) => {
        if (response.type === 'COMPLETE') {
          // 3. Display it locally instead of overwriting the official record
          setAiSummary(response.payload.result);
          toast.success("Offline AI Summary generated (Draft mode)");
          setLoading(false);
        } else if (response.type === 'ERROR') {
          toast.error("Offline AI failed: " + response.payload.error);
          setLoading(false);
        }
      });
      
    } catch (err) {
      toast.error("Failed to generate offline summary");
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!aiSummary) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/summary/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: aiSummary }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("AI Summary saved to case record");
      setAiSummary(null);
      router.refresh();
    } catch (error) {
      toast.error("Failed to save AI summary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 relative">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleGenerate} 
        disabled={loading}
        className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800"
        title="Generates a summary entirely on your device using a local LLM"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        ) : (
          <Cpu className="w-4 h-4 text-indigo-500" />
        )}
        {loading ? "Processing locally..." : "Generate Local AI Summary"}
      </Button>
      {aiSummary && (
        <div className="mt-4 p-4 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded text-sm w-[400px] text-left shadow-sm z-50 absolute right-0 top-full">
          <p className="font-semibold mb-2 flex items-center justify-between">
            AI Generated Insights (Draft)
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-indigo-500" onClick={() => setAiSummary(null)}>×</Button>
          </p>
          <p className="whitespace-pre-wrap">{aiSummary}</p>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save to Case
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
