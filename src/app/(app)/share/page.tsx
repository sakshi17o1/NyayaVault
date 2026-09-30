"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

type DocInfo = {
  id: string;
  title: string;
  caseNumber: string;
  ocrKeys: string[];
};

export default function ShareDashboard() {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [selectedDocId, setSelectedDocId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiryHours, setExpiryHours] = useState("24");
  const [redactedFields, setRedactedFields] = useState<string[]>([]);
  
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    // Basic fetch to populate a dropdown. We'll use the search API with an empty/broad query
    // or create a simple list endpoint. Since we don't have a simple list endpoint, 
    // let's just do a search for 'a' or just implement a quick list via a new API if needed.
    // Wait, let's fetch from the /api/search?q= (Wait, our search requires length < 2 to return empty).
    // Let's just create a quick fetch inside a useEffect from a dedicated endpoint. 
    // For now, I'll assume we have an endpoint or I'll add one.
    fetchDocs();
  }, []);

  async function fetchDocs() {
    try {
      const res = await fetch("/api/documents/list"); // I will need to create this simple list endpoint!
      const data = await res.json();
      setDocuments(data.documents || []);
    } finally {
      setLoadingDocs(false);
    }
  }

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  const toggleRedaction = (field: string) => {
    setRedactedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDocId || !recipient || !purpose) return;

    setSharing(true);
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, purpose, expiryHours, redactedFields })
      });
      const data = await res.json();
      if (res.ok) {
        setShareUrl(data.shareUrl);
      } else {
        toast.error("Error: " + data.error);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">External Sharing</h1>
        <p className="text-slate-500 mt-1">Generate secure, time-bound, and redacted links for external parties.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Secure Link</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <p className="text-sm text-slate-500">Loading documents...</p>
            ) : (
              <form onSubmit={handleShare} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Select Document</label>
                  <select
                    required
                    value={selectedDocId}
                    onChange={(e) => {
                      setSelectedDocId(e.target.value);
                      setRedactedFields([]);
                    }}
                    className="w-full text-sm p-2 border rounded"
                  >
                    <option value="" disabled>Select...</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>{d.caseNumber} - {d.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Recipient Name / Organization</label>
                  <input
                    required
                    type="text"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    className="w-full text-sm p-2 border rounded"
                    placeholder="e.g. Defense Counsel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Purpose</label>
                  <input
                    required
                    type="text"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    className="w-full text-sm p-2 border rounded"
                    placeholder="e.g. Discovery Review"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Expiration</label>
                  <select
                    value={expiryHours}
                    onChange={e => setExpiryHours(e.target.value)}
                    className="w-full text-sm p-2 border rounded"
                  >
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                  </select>
                </div>

                {selectedDoc && selectedDoc.ocrKeys.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-medium mb-2 text-red-600">
                      Redact Specific Fields
                    </label>
                    <div className="space-y-2">
                      {selectedDoc.ocrKeys.map(key => (
                        <label key={key} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={redactedFields.includes(key)}
                            onChange={() => toggleRedaction(key)}
                            className="rounded border-slate-300"
                          />
                          <span>{key}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={sharing || !selectedDocId} className="w-full">
                  {sharing ? "Generating..." : "Generate Secure Link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {shareUrl && (
          <Card className="border-emerald-200 bg-white shadow-lg overflow-hidden h-fit">
            <div className="bg-emerald-50 border-b border-emerald-100 p-6 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">Secure link generated</h3>
              <p className="text-sm text-emerald-600 font-medium mt-1">Expires in {expiryHours} hours</p>
            </div>
            
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 font-medium mb-1">Recipient</p>
                  <p className="font-semibold text-slate-900">{recipient}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">Purpose</p>
                  <p className="font-semibold text-slate-900">{purpose}</p>
                </div>
              </div>

              {redactedFields.length > 0 && (
                <div>
                  <p className="text-slate-500 font-medium text-sm mb-2">Redactions applied</p>
                  <div className="flex flex-wrap gap-2">
                    {redactedFields.map(field => (
                      <span key={field} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                        <Check className="h-3 w-3 text-emerald-500" />
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Copied to clipboard!");
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy secure link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(shareUrl, '_blank')}
                  className="flex-1"
                >
                  Open preview
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
