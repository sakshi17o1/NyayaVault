"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useToast } from "@/components/ui/ToastProvider";

type DocInfo = {
  id: string;
  title: string;
  caseNumber: string;
  ownerDepartment: string;
};

type CustodyEvent = {
  id: string;
  toDepartment: string;
  reason: string;
  signatureRef: string;
  ledgerProofId: string | null;
  createdAt: string;
  actor: {
    name: string;
    role: string;
    department: string | null;
  };
};

export function CustodyDashboard({ documents, currentDept }: { documents: DocInfo[], currentDept: string }) {
  const toast = useToast();
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [events, setEvents] = useState<CustodyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Transfer Form State
  const [toDept, setToDept] = useState("");
  const [reason, setReason] = useState("");

  // Handle OAuth/ESP Callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const signature = params.get("signature");
      const callbackDocId = params.get("docId");
      
      if (signature && callbackDocId) {
        // Automatically set the docId so the UI shows the loading correctly
        setSelectedDocId(callbackDocId);
        completeTransferWithSignature(callbackDocId, signature);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadTimeline(selectedDocId);
    } else {
      setEvents([]);
    }
  }, [selectedDocId]);

  async function loadTimeline(docId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/custody`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      } else {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function completeTransferWithSignature(docId: string, signature: string) {
    setTransferring(true);
    try {
      const res = await fetch(`/api/documents/${docId}/custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedToken: signature }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Custody successfully transferred with cryptographic e-Sign!");
        setTimeout(() => {
          window.location.href = "/custody"; // clear URL params and reload
        }, 1500);
      } else {
        toast.error("Transfer failed: " + data.error);
      }
    } finally {
      setTransferring(false);
    }
  }

  function handleInitiateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDocId || !toDept || !reason) return;

    // Redirect to the external e-Sign Gateway simulation
    window.location.href = `/esign-gateway?docId=${selectedDocId}&toDept=${encodeURIComponent(toDept)}&reason=${encodeURIComponent(reason)}`;
  }

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const hasCustody = selectedDoc?.ownerDepartment === currentDept;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Evidence for Custody Transfer</CardTitle>
          <p className="text-sm text-slate-500">View the unbroken chain of custody or securely transfer possession.</p>
        </CardHeader>
        <CardContent>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="flex h-10 w-full max-w-xl rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-navy"
          >
            <option value="" disabled>Select a document...</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.caseNumber} - {d.title} (Currently with: {d.ownerDepartment})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedDoc && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transfer Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Transfer Custody</CardTitle>
                <Badge tone={hasCustody ? "green" : "slate"}>
                  {hasCustody ? "You Have Custody" : "Read Only"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">Sign over the digital authority of this evidence to another department.</p>
            </CardHeader>
            <CardContent>
              {!hasCustody ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600">
                  You cannot transfer custody because this document is currently with <strong>{selectedDoc.ownerDepartment}</strong>.
                </div>
              ) : transferring ? (
                 <div className="p-8 text-center text-slate-500 animate-pulse border border-slate-200 rounded">
                   Verifying cryptographic signature and anchoring to ledger...
                 </div>
              ) : (
                <form onSubmit={handleInitiateTransfer} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">To Department</label>
                    <select
                      required
                      value={toDept}
                      onChange={e => setToDept(e.target.value)}
                      className="w-full text-sm p-2 border border-slate-200 rounded focus:border-navy outline-none"
                    >
                      <option value="" disabled>Select receiving department...</option>
                      <option value="e-Forensics Mock Lab">e-Forensics Mock Lab</option>
                      <option value="e-Prosecution Mock Cell">e-Prosecution Mock Cell</option>
                      <option value="Oversight / Court Record (Demo)">District Court (Oversight)</option>
                      <option value="Women Safety Cell (Demo)">Women Safety Cell (IO)</option>
                      <option value="Station House (Demo)">Station House (SHO)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Transfer</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Forensic examination of handwriting"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full text-sm p-2 border border-slate-200 rounded focus:border-navy outline-none"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-4">Clicking the button below will redirect you to the simulated e-Sign Gateway for cryptographic authentication.</p>
                    <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                      Authenticate via e-Sign Gateway (Demo)
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Chain of Custody Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-500 animate-pulse">Loading timeline...</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-slate-500">No custody transfers recorded yet.</p>
              ) : (
                <div className="relative border-l border-slate-200 ml-3 space-y-6">
                  {events.map((evt, idx) => (
                    <div key={evt.id} className="pl-6 relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-navy border-2 border-white ring-2 ring-slate-100" />
                      
                      <div className="text-xs text-slate-500 mb-1">
                        {new Date(evt.createdAt).toLocaleString("en-IN")}
                      </div>
                      <div className="font-medium text-sm text-slate-900">
                        Transferred to {evt.toDepartment}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        <span className="font-semibold">By:</span> {evt.actor.name} ({evt.actor.role})
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-semibold">Reason:</span> {evt.reason}
                      </div>
                      <div className="mt-2 text-xs font-mono text-slate-400 break-all bg-slate-50 p-2 rounded border border-slate-100 max-h-32 overflow-y-auto">
                        <strong>e-Sign JWT:</strong><br/>{evt.signatureRef}<br/><br/>
                        <strong>Ledger Proof:</strong><br/>{evt.ledgerProofId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
