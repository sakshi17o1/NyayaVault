"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export function ReviewForm({ 
  docId, 
  initialData,
  rawText,
  isApproved,
  onSuccess,
  onCancel
}: { 
  docId: string;
  initialData: string;
  rawText?: string;
  isApproved?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  
  // Parse initial data
  const [fields, setFields] = useState<Record<string, any>>(() => {
    try {
      const parsed = JSON.parse(initialData);
      return parsed.fields || parsed;
    } catch {
      return {};
    }
  });
  
  const [confidences] = useState<Record<string, number>>(() => {
    try {
      const parsed = JSON.parse(initialData);
      return parsed.confidences || {};
    } catch {
      return {};
    }
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  // Determine low confidence fields
  const reviewRequiredFields = Object.keys(fields).filter(
    (key) => (confidences[key] || 0) < 0.8
  );

  const formatConfidence = (val?: number) => {
    if (val === undefined) return { text: "N/A", color: "text-slate-400", bg: "bg-slate-100" };
    const pct = Math.round(val * 100);
    if (pct >= 80) return { text: `🟢 ${pct}%`, color: "text-green-700", bg: "bg-green-100" };
    if (pct >= 50) return { text: `🟠 ${pct}%`, color: "text-amber-700", bg: "bg-amber-100" };
    return { text: `🔴 ${pct}%`, color: "text-red-700", bg: "bg-red-100" };
  };

  async function handleApprove() {
    setBusy(true);
    const res = await fetch(`/api/documents/${docId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctedFields: fields })
    });
    if (res.ok) {
      if (onSuccess) onSuccess();
    } else {
      toast.error("Failed to approve document");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {reviewRequiredFields.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-bold">
            {reviewRequiredFields.length} field{reviewRequiredFields.length > 1 ? "s" : ""} require review before indexing
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Raw Extracted Text</h2>
          </div>
          <div className="p-4 flex-1">
            <pre className="h-96 overflow-auto rounded bg-slate-50 p-4 text-xs text-slate-600 whitespace-pre-wrap font-mono border border-slate-200">
              {rawText || "No raw text available."}
            </pre>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm flex-1">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-5 py-4 font-bold">Field</th>
              <th className="px-5 py-4 font-bold">Extracted value</th>
              <th className="px-5 py-4 font-bold">Confidence</th>
              <th className="px-5 py-4 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {Object.entries(fields).map(([key, value]) => {
              const conf = formatConfidence(confidences[key]);
              const isEditing = editingField === key;
              const isLowConf = (confidences[key] || 0) < 0.8;

              return (
                <tr key={key} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-5 py-4 font-bold text-slate-900 capitalize w-1/4">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </td>
                  <td className="px-5 py-4 w-2/5">
                    {isEditing ? (
                      <Input
                        value={Array.isArray(value) ? value.join(", ") : (value || "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFields(prev => ({
                            ...prev,
                            [key]: Array.isArray(value) ? val.split(",").map(s => s.trim()) : val
                          }));
                        }}
                        className="h-9 py-1 text-sm font-bold bg-white border-blue-300 focus-visible:ring-blue-500 shadow-sm"
                        autoFocus
                        onBlur={() => setEditingField(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null); }}
                      />
                    ) : (
                      <span 
                        className={`block ${!isApproved ? 'cursor-pointer hover:bg-slate-100' : ''} font-medium p-1 -ml-1 rounded transition-colors ${!value ? 'text-slate-400 italic' : 'text-slate-800'}`}
                        onClick={() => { if (!isApproved) setEditingField(key); }}
                      >
                        {Array.isArray(value) ? value.join(", ") : (value || "—")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 w-1/5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold shadow-sm ${conf.bg} ${conf.color}`}>
                      {conf.text}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right w-1/6">
                    {isApproved ? (
                      <CheckCircle2 className="h-4 w-4 ml-auto text-green-600" />
                    ) : isEditing ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50">Save</Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setEditingField(key)}
                        className={`h-8 text-xs font-bold transition-all ${isLowConf ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-100 bg-amber-50 shadow-sm' : 'text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100'}`}
                      >
                        {isLowConf ? "Review" : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-6">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy || isApproved} className="h-11 px-8 font-bold shadow-sm">Cancel</Button>
        )}
        <Button onClick={handleApprove} disabled={busy || isApproved} className={`h-11 px-8 font-bold ${isApproved ? 'bg-green-600 hover:bg-green-700' : 'bg-[#0F294D] hover:bg-[#0F294D]/90'} text-white shadow-md transition-all`}>
          {isApproved ? "Approved & Indexed" : (busy ? "Approving..." : "Approve & Index Data")}
        </Button>
      </div>
    </div>
  );
}
