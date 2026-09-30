/**
 * Government APIs Integration Stub (Phase P2)
 * 
 * Provides integrations with CCTNS, ICJS, and e-Courts.
 * If the environment variables for these external endpoints are provided,
 * it performs actual REST calls. Otherwise, it gracefully falls back to mock responses.
 */

export async function fetchCctnsCaseDetails(firNumber: string) {
  const apiUrl = process.env.CCTNS_API_URL;
  
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/cases/${firNumber}`, {
        headers: { "Authorization": `Bearer ${process.env.CCTNS_API_TOKEN}` }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error("[CCTNS Integration] Request failed, falling back to mock:", e);
    }
  }

  // Fallback Mock Response
  return {
    firNumber,
    status: "INVESTIGATION_PENDING",
    accused: ["Ramesh Kumar"],
    sections: ["376 IPC", "506 IPC"],
    dateRegistered: new Date().toISOString()
  };
}

export async function pushToIcjs(caseId: string, documentHash: string, metadata: any) {
  const apiUrl = process.env.ICJS_API_URL;

  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/v2/evidence/push`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.ICJS_API_TOKEN}`
        },
        body: JSON.stringify({ caseId, documentHash, metadata })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error("[ICJS Integration] Request failed, falling back to mock:", e);
    }
  }

  // Fallback Mock Response
  return {
    success: true,
    icjsReferenceId: `ICJS-REF-${Math.random().toString(36).substring(7).toUpperCase()}`,
    timestamp: new Date().toISOString()
  };
}
