"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Circle, FileCheck, X, Plus, UploadCloud, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ReviewForm } from "./ReviewForm";

type CaseOption = { id: string; caseNumber: string; title: string };

type PipelineState = "idle" | "uploading" | "polling" | "reviewing" | "done" | "error";

export type DocumentDraft = {
  id: string;
  file: File;
  title: string;
  docType: string;
  state: PipelineState;
  uiStep: number;
  actualStep: number;
  docId?: string;
  ocrData?: string;
  rawText?: string;
  errorMessage?: string;
  isAnalyzingType?: boolean;
  reviewedById?: string | null;
  docStatus?: string;
};

export function UploadForm({ cases }: { cases: CaseOption[] }) {
  const toast = useToast();
  const [caseId, setCaseId] = useState(cases.length > 0 ? cases[0].id : "");
  const [drafts, setDrafts] = useState<DocumentDraft[]>([]);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);
  const [malwareAlert, setMalwareAlert] = useState<{fileName: string, error: string} | null>(null);

  // We are in "pipeline phase" if ANY draft is beyond idle/error
  const isInPipelinePhase = drafts.length > 0 && drafts.some(d => d.state !== "idle" && d.state !== "error");
  const isAllDone = drafts.length > 0 && drafts.every(d => d.state === "done" || d.state === "error");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    
    const newDrafts = newFiles.map(file => {
      const title = file.name.replace(/\.[^/.]+$/, "");
      const lowerName = file.name.toLowerCase();
      let docType = "FIR";
      
      if (lowerName.includes("forensic")) docType = "FORENSIC_REPORT";
      else if (lowerName.includes("witness") || lowerName.includes("statement")) docType = "WITNESS_STATEMENT";
      else if (lowerName.includes("charge") && lowerName.includes("sheet")) docType = "CHARGE_SHEET";
      else if (lowerName.includes("police") && lowerName.includes("report")) docType = "POLICE_REPORT";
      else if (lowerName.includes("notice")) docType = "NOTICE";
      else if (lowerName.includes("judgment")) docType = "JUDGMENT";
      else if (lowerName.includes("complaint")) docType = "COMPLAINT";
      else if (lowerName.includes("medical")) docType = "MEDICAL_REPORT";
      else if (lowerName.includes("closure")) docType = "CLOSURE_REPORT";
      else if (lowerName.includes("seizure") || lowerName.includes("panchnama")) docType = "SEIZURE_MEMO_PANCHNAMA";
      else if (lowerName.includes("bail")) docType = "BAIL_ORDER";
      else if (lowerName.includes("confession")) docType = "CONFESSION_STATEMENT";
      
      return {
        id: Math.random().toString(36).substring(7),
        file,
        title,
        docType,
        state: "idle" as PipelineState,
        uiStep: 0,
        actualStep: 0,
        isAnalyzingType: true, // Start analyzing immediately
      };
    });
    
    setDrafts(prev => [...prev, ...newDrafts]);
    
    // Asynchronously call the API for each draft to auto-categorize based on file contents
    newDrafts.forEach(async (draft) => {
      try {
        const formData = new FormData();
        formData.append("file", draft.file);
        
        const res = await fetch("/api/documents/suggest-type", {
          method: "POST",
          body: formData,
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.suggestedType && data.suggestedType !== "UNKNOWN") {
            updateDraft(draft.id, { 
              docType: data.suggestedType,
              isAnalyzingType: false 
            });
            return;
          }
        }
      } catch (err) {
        console.error("Failed to analyze doc type", err);
      }
      // If failed or returned unknown, clear flag
      updateDraft(draft.id, { isAnalyzingType: false });
    });

    // Reset file input
    e.target.value = "";
  }

  function updateDraft(id: string, updates: Partial<DocumentDraft>) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }

  function removeDraft(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id));
  }

  async function handleUploadAll() {
    if (drafts.length === 0) return;
    setIsUploadingGlobal(true);

    const pendingDrafts = drafts.filter(d => d.state === "idle" || d.state === "error");
    
    // We update all pending to uploading first
    pendingDrafts.forEach(d => updateDraft(d.id, { state: "uploading", errorMessage: undefined }));

    // Upload in parallel
    await Promise.all(pendingDrafts.map(async (draft) => {
      const formData = new FormData();
      formData.append("file", draft.file);
      formData.append("caseId", caseId);
      formData.append("title", draft.title);
      formData.append("docType", draft.docType);

      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          updateDraft(draft.id, {
            docId: data.documentId,
            state: "polling",
            uiStep: 0,
            actualStep: 5, // Upload, Scan, Hash, Encrypt, Anchor are done synchronously
          });
          
          // Trigger background OCR task
          fetch(`/api/documents/${data.documentId}/process-ocr`, { method: "POST" }).catch(console.error);
        } else {
          updateDraft(draft.id, { state: "error", errorMessage: data.error });
          const errLower = data.error.toLowerCase();
          if (errLower.includes("malware") || errLower.includes("signature")) {
            setMalwareAlert({ fileName: draft.file.name, error: data.error });
          } else {
            toast.error(`Upload failed for ${draft.title}: ` + data.error);
          }
        }
      } catch (err) {
        updateDraft(draft.id, { state: "error", errorMessage: "Network error occurred." });
        toast.error(`Network error for ${draft.title}`);
      }
    }));
    
    setIsUploadingGlobal(false);
  }

  function resetAll() {
    setDrafts([]);
    setIsUploadingGlobal(false);
  }

  const malwareModal = malwareAlert && (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600" />
          <h3 className="font-bold text-red-900 text-lg">CRITICAL: Malware Detected</h3>
        </div>
        <div className="p-6 text-slate-700">
          <p className="mb-4">
            Malware or a malicious file signature was detected during the scanning of your file:
          </p>
          <p className="font-mono bg-slate-100 p-2 rounded text-sm mb-4 truncate text-center font-bold text-red-700">
            {malwareAlert.fileName}
          </p>
          <p className="text-sm font-medium mb-4 text-red-600">
            Error: {malwareAlert.error}
          </p>
          <p className="text-sm text-slate-500">
            The upload has been completely blocked and aborted. This incident has been logged in the system Audit Trail.
          </p>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <Button onClick={() => setMalwareAlert(null)} className="bg-red-600 hover:bg-red-700 text-white font-bold">
            Acknowledge & Close
          </Button>
        </div>
      </div>
    </div>
  );

  if (isInPipelinePhase) {
    return (
      <>
        {malwareModal}
        <div className="space-y-6">
          {drafts.map((draft) => (
            <DocumentProcessor 
              key={draft.id} 
              draft={draft} 
              updateDraft={updateDraft} 
            />
          ))}
          
          {isAllDone && (
            <Button onClick={resetAll} className="mt-4 bg-[#0F294D] hover:bg-[#0F294D]/90 text-white w-full h-12 font-bold shadow-md">
              Upload More Documents
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {malwareModal}
      <Card>
        <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Assign to Case</label>
            <select 
              value={caseId} 
              onChange={e => setCaseId(e.target.value)}
              className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.caseNumber} - {c.title}</option>
              ))}
            </select>
          </div>

          {drafts.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1 text-slate-700">Selected Files ({drafts.length})</label>
              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                {drafts.map((draft) => (
                  <div key={draft.id} className="flex flex-col sm:flex-row gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50/50 items-start sm:items-center relative group">
                    <button 
                      type="button"
                      onClick={() => removeDraft(draft.id)}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-colors shadow-sm bg-white border border-slate-200 hover:border-red-500 z-10"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    
                    <div className="w-full sm:w-1/2 pr-6">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                      <input 
                        type="text" 
                        value={draft.title} 
                        onChange={e => updateDraft(draft.id, { title: e.target.value })}
                        className="w-full text-sm p-2 border border-slate-200 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Document Title"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 truncate" title={draft.file.name}>{draft.file.name}</p>
                    </div>
                    
                    <div className="w-full sm:w-1/2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-500">Document Type</label>
                        {draft.isAnalyzingType && (
                          <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Analyzing...
                          </span>
                        )}
                      </div>
                      <select 
                        value={draft.docType} 
                        onChange={e => updateDraft(draft.id, { docType: e.target.value })}
                        disabled={draft.isAnalyzingType}
                        className={`w-full text-sm p-2 border border-slate-200 rounded shadow-sm focus:ring-2 focus:ring-blue-500 outline-none ${draft.isAnalyzingType ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`}
                      >
                        <option value="FIR">FIR</option>
                        <option value="POLICE_REPORT">Police Report</option>
                        <option value="WITNESS_STATEMENT">Witness Statement</option>
                        <option value="CHARGE_SHEET">Charge Sheet</option>
                        <option value="FORENSIC_REPORT">Forensic Report</option>
                        <option value="EVIDENCE_RECORD">Evidence Record</option>
                        <option value="COURT_FILING">Court Filing</option>
                        <option value="NOTICE">Notice</option>
                        <option value="JUDGMENT">Judgment</option>
                        <option value="COMPLAINT">Complaint</option>
                        <option value="ARREST_MEMO">Arrest Memo</option>
                        <option value="SEIZURE_MEMO_PANCHNAMA">Seizure Memo / Panchnama</option>
                        <option value="MEDICAL_REPORT">Medical Report</option>
                        <option value="CONFESSION_STATEMENT">Confession Statement</option>
                        <option value="REMAND_APPLICATION">Remand Application</option>
                        <option value="BAIL_ORDER">Bail Order</option>
                        <option value="CLOSURE_REPORT">Closure Report</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
            <div className="relative flex-1">
              <input 
                type="file" 
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button type="button" variant="outline" className="w-full border-dashed border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-blue-700 h-12">
                <Plus className="h-5 w-5 mr-2" />
                Add Files
              </Button>
            </div>
            
            {drafts.length > 0 && (
              <Button 
                onClick={handleUploadAll} 
                disabled={isUploadingGlobal} 
                className="flex-1 bg-[#0F294D] hover:bg-[#0F294D]/90 text-white font-bold h-12 shadow-md"
              >
                {isUploadingGlobal ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</span>
                ) : (
                  <span className="flex items-center gap-2"><UploadCloud className="h-5 w-5" /> Upload & Anchor All</span>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

// Sub-component to manage individual file pipelines independently
function DocumentProcessor({ draft, updateDraft }: { draft: DocumentDraft, updateDraft: (id: string, updates: Partial<DocumentDraft>) => void }) {
  console.log("Rendering DocumentProcessor, state:", draft.state);
  
  // Catch up uiStep to actualStep smoothly
  useEffect(() => {
    if (draft.state === "polling" && draft.uiStep < draft.actualStep) {
      const timer = setTimeout(() => {
        updateDraft(draft.id, { uiStep: Math.min(draft.uiStep + 1, draft.actualStep) });
      }, 600);
      return () => clearTimeout(timer);
    }
    if (draft.state === "polling" && draft.uiStep === 7 && draft.docId) {
      const fetchOcr = async () => {
        try {
          const res = await fetch(`/api/documents/${draft.docId}/ocr`);
          if (res.ok) {
            const data = await res.json();
            updateDraft(draft.id, {
              ocrData: JSON.stringify(data.extractedData || {}),
              rawText: data.rawText || "",
              state: data.status === "APPROVED" ? "done" : "reviewing",
              docStatus: data.status,
              reviewedById: data.reviewedById
            });
          } else {
            const errText = await res.text();
            updateDraft(draft.id, { state: "error", errorMessage: `OCR API failed: ${res.status} ${errText}`, uiStep: 7 });
          }
        } catch (e: any) {
          updateDraft(draft.id, { state: "error", errorMessage: `OCR Fetch failed: ${e.message}`, uiStep: 7 });
        }
      };
      fetchOcr();
    }
    // Note: Omit updateDraft from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.state, draft.uiStep, draft.actualStep, draft.docId, draft.id]);

  // Poll actual backend state
  useEffect(() => {
    if (draft.state === "polling" && draft.actualStep < 7 && draft.docId) {
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/documents/${draft.docId}/status`);
          if (res.ok) {
            const data = await res.json();
            if (data.status !== "PROCESSING" || data.hasOcr) {
              updateDraft(draft.id, { actualStep: 7 });
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.state, draft.actualStep, draft.docId, draft.id]);

  return (
    <Card className={`shadow-sm border transition-colors ${draft.state === "done" ? "border-green-200" : (draft.state === "error" ? "border-red-200" : "border-blue-100")}`}>
      <CardHeader className={`${draft.state === "done" ? "bg-green-50/50" : (draft.state === "error" ? "bg-red-50/50" : "bg-blue-50/50")} border-b pb-3`}>
        <div className="flex justify-between items-center">
          <CardTitle className={`flex items-center gap-2 text-sm ${draft.state === "done" ? "text-green-900" : (draft.state === "error" ? "text-red-900" : "text-blue-900")}`}>
            <FileCheck className="h-5 w-5 opacity-70" />
            {draft.title} <span className="font-normal text-xs opacity-70">({draft.docType})</span>
          </CardTitle>
          {draft.state === "done" && (
            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">
              {draft.reviewedById ? "APPROVED" : "AUTO-APPROVED (> 60% Confidence)"}
            </span>
          )}
          {draft.state === "error" && <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">FAILED</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        
        <div className="space-y-3 mb-4">
          <PipelineItem label="File received" active={draft.uiStep >= 0} done={draft.uiStep >= 1 && !(draft.state === "error" && draft.uiStep === 0)} error={draft.state === "error" && draft.uiStep === 0} />
          <PipelineItem label="Malware scan passed" active={draft.uiStep >= 1} done={draft.uiStep >= 2 && !(draft.state === "error" && draft.uiStep === 1)} error={draft.state === "error" && draft.uiStep === 1} />
          <PipelineItem label="SHA-256 calculated" active={draft.uiStep >= 2} done={draft.uiStep >= 3 && !(draft.state === "error" && draft.uiStep === 2)} error={draft.state === "error" && draft.uiStep === 2} />
          <PipelineItem label="Evidence encrypted" active={draft.uiStep >= 3} done={draft.uiStep >= 4 && !(draft.state === "error" && draft.uiStep === 3)} error={draft.state === "error" && draft.uiStep === 3} />
          <PipelineItem label="Integrity proof recorded" active={draft.uiStep >= 4} done={draft.uiStep >= 5 && !(draft.state === "error" && draft.uiStep === 4)} error={draft.state === "error" && draft.uiStep === 4} />
          <PipelineItem label="OCR processing" active={draft.uiStep >= 5} done={draft.uiStep >= 6 && !(draft.state === "error" && draft.uiStep === 5)} error={draft.state === "error" && draft.uiStep === 5} />
          <PipelineItem label="Metadata extraction" active={draft.uiStep >= 6} done={draft.uiStep >= 7 && !(draft.state === "error" && draft.uiStep === 6)} error={draft.state === "error" && draft.uiStep === 6} />
          <PipelineItem 
            label={`Human review ${draft.state === "polling" ? "(Pending)" : (draft.state === "done" ? "(Done)" : "(In Progress)")}`}
            active={draft.state === "reviewing"} 
            done={draft.state === "done"} 
            error={draft.state === "error" && draft.uiStep >= 7}
          />
        </div>

        {draft.state === "error" && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 mt-4">
            {draft.errorMessage || "An unknown error occurred during processing."}
          </div>
        )}
        {(draft.state === "reviewing" || (draft.state === "done" && !draft.reviewedById)) && draft.docId && (
          <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-bold text-navy mb-4 uppercase tracking-wider">
              {draft.state === "done" ? "Extraction Results" : "Review Extraction"}
            </h3>
            <ReviewForm 
              docId={draft.docId} 
              initialData={draft.ocrData || "{}"} 
              rawText={draft.rawText}
              isApproved={draft.state === "done"}
              onSuccess={() => updateDraft(draft.id, { state: "done", reviewedById: "manual" })} 
            />
          </div>
        )}
        
        {draft.state === "done" && draft.docId && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
            <div>
              <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider mb-0.5">Evidence ID</p>
              <p className="font-mono text-sm font-bold text-green-700">{draft.docId}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineItem({ label, active, done, error }: { label: string; active: boolean; done: boolean; error?: boolean }) {
  if (error) {
    return (
      <div className="flex items-center gap-3 text-red-600 font-bold text-sm">
        <X className="h-4 w-4" />
        <span>{label} (Failed)</span>
      </div>
    );
  }
  if (done) {
    return (
      <div className="flex items-center gap-3 text-green-600 font-bold text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>{label}</span>
      </div>
    );
  }
  if (active) {
    return (
      <div className="flex items-center gap-3 text-blue-600 font-bold text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}...</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-slate-400 font-medium text-sm">
      <Circle className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}