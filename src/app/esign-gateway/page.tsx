"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

function ESignForm() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const docId = searchParams.get("docId");
  const toDept = searchParams.get("toDept");
  const reason = searchParams.get("reason");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId || !toDept || !reason) {
      toast.error("Missing required parameters from application.");
    }
  }, [docId, toDept, reason, toast]);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);

    try {
      const res = await fetch("/api/esign-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, toDept, reason, otp })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Redirect back to the App's callback URL
        router.push(`/custody?signature=${data.jwt}&docId=${docId}&toDept=${encodeURIComponent(toDept!)}&reason=${encodeURIComponent(reason!)}`);
      } else {
        toast.error("Authentication failed: " + data.error);
        setLoading(false);
      }
    } catch (error) {
      toast.error("Network error.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border-t-4 border-orange-500">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          e-Sign Gateway <span className="text-red-600 font-extrabold uppercase text-lg ml-2 border-2 border-red-600 px-2 rounded">[SIMULATION]</span>
        </h1>
        <p className="text-sm font-bold text-red-600 mt-2">
          WARNING: This is a simulation. It is NOT a live CCA-licensed DSC integration.
        </p>
      </div>

      <div className="bg-slate-50 p-4 rounded text-sm mb-6 border border-slate-200">
        <p className="mb-2"><strong>Action:</strong> Custody Transfer Authorization</p>
        <p className="mb-2"><strong>To:</strong> {toDept}</p>
        <p><strong>Reason:</strong> {reason}</p>
      </div>

      <form onSubmit={handleSign} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Aadhaar / e-Pramaan OTP</label>
          <input
            type="text"
            required
            maxLength={6}
            placeholder="Enter 6-digit OTP (e.g. 123456)"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full tracking-widest text-center text-xl p-3 border border-slate-300 rounded focus:border-orange-500 outline-none focus:ring-1 focus:ring-orange-500"
          />
          <p className="text-xs text-slate-400 mt-2 text-center">For demo purposes, any 6-digit number will work.</p>
        </div>

        <button 
          type="submit" 
          disabled={loading || otp.length < 6}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium p-3 rounded transition-colors disabled:opacity-50"
        >
          {loading ? "Authenticating & Signing..." : "Sign Document"}
        </button>
      </form>

      <div className="mt-8 text-center text-xs font-bold text-red-500">
        <p>*** SIMULATION ONLY ***</p>
        <p>Not legally binding. No CCA-licensed DSC integrated.</p>
      </div>
    </div>
  );
}

export default function ESignGatewayPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <Suspense fallback={<p>Loading Gateway...</p>}>
        <ESignForm />
      </Suspense>
    </div>
  );
}
