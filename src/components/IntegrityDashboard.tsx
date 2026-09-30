"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useToast } from "@/components/ui/ToastProvider";

type DocOption = {
  id: string;
  title: string;
  type: string;
  version: number;
};

type CaseGroup = {
  id: string;
  caseNumber: string;
  title: string;
  documents: DocOption[];
};

export function IntegrityDashboard({ cases }: { cases: CaseGroup[] }) {
  const toast = useToast();
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    computedHash: string;
    anchoredHash: string;
    ledgerTxRef: string;
    error?: string;
  } | null>(null);

  const flatDocs = cases.flatMap(c => c.documents);
  const selectedDoc = flatDocs.find(d => d.id === selectedDocId);

  async function verifyIntegrity() {
    if (!selectedDocId) return;
    setVerifying(true);
    setResult(null);

    try {
      const res = await fetch(`/api/documents/${selectedDocId}/integrity?t=${Date.now()}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        status: "ERROR",
        computedHash: "",
        anchoredHash: "",
        ledgerTxRef: "",
        error: "Network error during verification",
      });
    } finally {
      setVerifying(false);
    }
  }

  async function tamperDocument() {
    if (!selectedDocId) return;
    if (!confirm("This will permanently corrupt the document on disk to demonstrate a cryptographic mismatch. Continue?")) return;
    
    setTampering(true);
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/tamper`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to tamper document");
      }
      toast.warning("Document corrupted. Run verification again to see the result.");
      setResult(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Tamper failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Document</CardTitle>
          <p className="text-sm text-slate-500">Select an assigned document to verify its cryptographic hash against the ledger.</p>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              setResult(null);
            }}
            className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-navy"
          >
            <option value="" disabled>Select a document...</option>
            {cases.map((c) => (
              <optgroup key={c.id} label={`${c.caseNumber} - ${c.title}`}>
                {c.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} (v{d.version})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="flex gap-3">
            <Button onClick={verifyIntegrity} disabled={!selectedDocId || verifying}>
              {verifying ? "Computing Hash..." : "Verify Integrity"}
            </Button>
            
            <Button variant="outline" onClick={tamperDocument} disabled={!selectedDocId || tampering || verifying} className="border-red-200 text-red-700 hover:bg-red-50">
              {tampering ? "Tampering..." : "Tamper (Demo)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.status === "MISMATCH" ? "border-red-300 bg-red-50/50" : "border-green-300 bg-green-50/50"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Verification Result</CardTitle>
              <Badge tone={result.status === "MISMATCH" ? "red" : "green"}>{result.status}</Badge>
            </div>
            {result.status === "MISMATCH" && (
              <p className="text-sm text-red-700 font-medium">
                Cryptographic mismatch detected. Document may have been altered outside the system. Requires forensic review.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Computed SHA-256 (From current file)</p>
              <p className="font-mono text-sm break-all mt-1 bg-white p-2 rounded border">{result.computedHash}</p>
            </div>
            
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Anchored SHA-256 (From Ledger)</p>
              <p className="font-mono text-sm break-all mt-1 bg-white p-2 rounded border">{result.anchoredHash}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Ledger Proof ID</p>
              <p className="font-mono text-sm mt-1">{result.ledgerTxRef}</p>
            </div>
            
            {result.error && (
              <div className="mt-4 p-3 bg-red-100 text-red-900 rounded text-sm">
                <strong>Error details: </strong> {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
