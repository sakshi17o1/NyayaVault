import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, writeAudit } from "@/lib/audit";
import { verifyLedgerChain } from "@/lib/integrity";
import { CertificateSignButton } from "./CertificateSignButton";

export default async function CaseCourtBundlePage({
  params
}: {
  params: Promise<{ caseId: string }>
}) {
  const user = await getSessionUser();
  if (!user) return notFound();

  const { caseId } = await params;

  const caseRecord = await prisma.caseRecord.findUnique({
    where: { id: caseId },
    include: {
      documents: {
        include: {
          versions: {
            orderBy: { version: "desc" }
          },
          custodyEvents: {
            include: { actor: { select: { name: true, department: true } } },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!caseRecord) return notFound();

  const authResult = await authorizeCase({
    user,
    caseId: caseRecord.id,
    action: "export",
    userAgent: "CaseCourtBundleGenerator",
  });

  if (!authResult.ok) return notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { caseId: caseRecord.id },
    orderBy: { createdAt: "asc" }
  });

  const ledgerVerification = await verifyLedgerChain();

  const firDocs = caseRecord.documents.filter(d => d.type === "FIR");
  const witnessDocs = caseRecord.documents.filter(d => d.type === "WITNESS_STATEMENT");
  const forensicDocs = caseRecord.documents.filter(d => d.type === "FORENSIC_REPORT");
  const otherDocs = caseRecord.documents.filter(d => !["FIR", "WITNESS_STATEMENT", "FORENSIC_REPORT"].includes(d.type));

  return (
    <div className="bg-white min-h-screen text-slate-900 p-8 print:p-0">
      <div className="max-w-4xl mx-auto space-y-8 print:w-full print:max-w-none">
        
        {/* Print Controls (Hidden when printing) */}
        <div className="flex justify-between items-center bg-slate-100 p-4 rounded-lg print:hidden border border-slate-200">
          <div>
            <h2 className="font-bold text-navy">Master Court Bundle Preview</h2>
            <p className="text-sm text-slate-500">Review the case compilation before exporting.</p>
          </div>
          <div className="space-x-4 flex items-center">
            <CertificateSignButton caseId={caseId} disabled={!ledgerVerification.valid} />
            <button 
              id="print-btn"
              className="px-4 py-2 bg-navy text-white rounded text-sm font-medium hover:bg-navy/90"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Certificate Header */}
        <div className="text-center border-b-4 border-slate-900 pb-6 mb-12">
          <h1 className="text-4xl font-serif font-bold uppercase tracking-widest">Master Court Bundle</h1>
          <p className="text-sm mt-2 uppercase font-semibold text-slate-600">Digital Evidence Compilation & Section 63 (BSA) Certificate</p>
          <p className="text-xs mt-1 text-slate-500">NyayaVault Cryptographic Integrity Framework</p>
        </div>

        {/* Case Overview */}
        <div className="bg-slate-50 border border-slate-300 p-6 rounded mb-8">
          <h2 className="font-bold border-b border-slate-300 mb-4 uppercase pb-2">Case Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-semibold text-slate-600">Case Number:</span> <span className="font-mono">{caseRecord.caseNumber}</span></div>
            <div><span className="font-semibold text-slate-600">FIR Number:</span> <span>{caseRecord.firNumber || "N/A"}</span></div>
            <div><span className="font-semibold text-slate-600">Title:</span> <span>{caseRecord.title}</span></div>
            <div><span className="font-semibold text-slate-600">Jurisdiction:</span> <span>{caseRecord.station}</span></div>
            <div><span className="font-semibold text-slate-600">Classification:</span> <span>{caseRecord.classification}</span></div>
            <div><span className="font-semibold text-slate-600">Total Documents:</span> <span className="font-bold">{caseRecord.documents.length}</span></div>
          </div>
        </div>

        {/* Master Index (TOC) */}
        <div className="mb-12">
          <h2 className="font-bold border-b border-slate-300 mb-4 uppercase pb-2">Master Index (Table of Contents)</h2>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2 w-16">Item #</th>
                <th className="p-2">Document Title</th>
                <th className="p-2">Type</th>
                <th className="p-2">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {caseRecord.documents.map((doc, idx) => (
                <tr key={doc.id} className="border-b border-slate-200">
                  <td className="p-2 text-center font-bold">{idx + 1}</td>
                  <td className="p-2">{doc.title}</td>
                  <td className="p-2">{doc.type}</td>
                  <td className="p-2">{doc.createdAt.toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="page-break-before print:break-before-page"></div>

        {/* Section 1: FIR / Initial Complaint */}
        <div className="mb-12">
          <h2 className="font-bold border-b-2 border-slate-800 mb-4 uppercase pb-2">Section I: FIR & Initial Complaints</h2>
          {firDocs.length === 0 ? <p className="text-sm italic text-slate-500">No documents in this category.</p> : firDocs.map(doc => (
            <div key={doc.id} className="mb-6 border-l-4 border-slate-300 pl-4 py-2">
              <h3 className="font-bold text-lg">{doc.title}</h3>
              <p className="text-xs text-slate-500 mb-2">Uploaded on: {doc.createdAt.toLocaleString("en-IN")}</p>
              {doc.versions.map((version, vIdx) => (
                <div key={version.id} className="text-sm space-y-1 mb-2">
                  <div className="font-semibold italic">Version {doc.versions.length - vIdx}</div>
                  <div><span className="font-semibold">SHA-256 Hash:</span> <span className="font-mono text-xs">{version.sha256Hash || "N/A"}</span></div>
                  <div><span className="font-semibold">Ledger Proof:</span> <span className="font-mono text-xs">{version.ledgerProofId || "N/A"}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Section 2: Witness Statements */}
        <div className="mb-12">
          <h2 className="font-bold border-b-2 border-slate-800 mb-4 uppercase pb-2">Section II: Witness Statements</h2>
          {witnessDocs.length === 0 ? <p className="text-sm italic text-slate-500">No documents in this category.</p> : witnessDocs.map(doc => (
            <div key={doc.id} className="mb-6 border-l-4 border-slate-300 pl-4 py-2">
              <h3 className="font-bold text-lg">{doc.title}</h3>
              <p className="text-xs text-slate-500 mb-2">Uploaded on: {doc.createdAt.toLocaleString("en-IN")}</p>
              {doc.versions.map((version, vIdx) => (
                <div key={version.id} className="text-sm space-y-1 mb-2">
                  <div className="font-semibold italic">Version {doc.versions.length - vIdx}</div>
                  <div><span className="font-semibold">SHA-256 Hash:</span> <span className="font-mono text-xs">{version.sha256Hash || "N/A"}</span></div>
                  <div><span className="font-semibold">Ledger Proof:</span> <span className="font-mono text-xs">{version.ledgerProofId || "N/A"}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Section 3: Forensic Reports */}
        <div className="mb-12">
          <h2 className="font-bold border-b-2 border-slate-800 mb-4 uppercase pb-2">Section III: Forensic & Medical Evidence</h2>
          {forensicDocs.length === 0 ? <p className="text-sm italic text-slate-500">No documents in this category.</p> : forensicDocs.map(doc => (
            <div key={doc.id} className="mb-6 border-l-4 border-slate-300 pl-4 py-2">
              <h3 className="font-bold text-lg">{doc.title}</h3>
              <p className="text-xs text-slate-500 mb-2">Uploaded on: {doc.createdAt.toLocaleString("en-IN")}</p>
              {doc.versions.map((version, vIdx) => (
                <div key={version.id} className="text-sm space-y-1 mb-2">
                  <div className="font-semibold italic">Version {doc.versions.length - vIdx}</div>
                  <div><span className="font-semibold">SHA-256 Hash:</span> <span className="font-mono text-xs">{version.sha256Hash || "N/A"}</span></div>
                  <div><span className="font-semibold">Ledger Proof:</span> <span className="font-mono text-xs">{version.ledgerProofId || "N/A"}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Section 4: Other Evidence */}
        {otherDocs.length > 0 && (
          <div className="mb-12">
            <h2 className="font-bold border-b-2 border-slate-800 mb-4 uppercase pb-2">Section IV: Additional Evidence</h2>
            {otherDocs.map(doc => (
              <div key={doc.id} className="mb-6 border-l-4 border-slate-300 pl-4 py-2">
                <h3 className="font-bold text-lg">{doc.title} ({doc.type})</h3>
                <p className="text-xs text-slate-500 mb-2">Uploaded on: {doc.createdAt.toLocaleString("en-IN")}</p>
                {doc.versions.map((version, vIdx) => (
                  <div key={version.id} className="text-sm space-y-1 mb-2">
                    <div className="font-semibold italic">Version {doc.versions.length - vIdx}</div>
                    <div><span className="font-semibold">SHA-256 Hash:</span> <span className="font-mono text-xs">{version.sha256Hash || "N/A"}</span></div>
                    <div><span className="font-semibold">Ledger Proof:</span> <span className="font-mono text-xs">{version.ledgerProofId || "N/A"}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="page-break-before print:break-before-page"></div>

        {/* Master Section 63 (BSA) Certificate & Cryptographic Proof */}
        <div className="border-4 border-slate-900 p-8 rounded-sm mt-8 break-inside-avoid relative">
          <div className="absolute top-4 right-4 border-2 border-red-800 text-red-800 font-bold uppercase p-2 text-xs opacity-50 transform rotate-12">
            Electronically Certified
          </div>
          <h2 className="font-bold text-2xl uppercase mb-6 text-center border-b border-slate-300 pb-4">Master Section 63 (BSA) Certificate</h2>
          
          <div className={`p-4 mb-6 rounded border ${ledgerVerification.valid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <h3 className="font-bold mb-1">Global Ledger Verification Status: {ledgerVerification.valid ? '✅ INTACT' : '❌ COMPROMISED'}</h3>
            {!ledgerVerification.valid && <p className="text-sm font-mono text-red-600">{ledgerVerification.error}</p>}
          </div>

          <p className="text-sm mb-6 leading-relaxed">
            This is to certify under Section 63 (read with Section 61 for legal validity of electronic records) of the Bharatiya Sakshya Adhiniyam, 2023 that the electronic records listed in this compilation 
            were produced by a computer system operating properly at the time of creation. The cryptographic hashes and ledger proofs 
            below guarantee that no tampering or alteration has occurred since the records were anchored to the NyayaVault ledger.
          </p>
          <table className="w-full text-xs text-left border-collapse font-mono mb-8">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2">Document</th>
                <th className="p-2">SHA-256 Hash</th>
                <th className="p-2">Ledger Status</th>
              </tr>
            </thead>
            <tbody>
              {caseRecord.documents.flatMap((doc) => doc.versions.map((v, i) => (
                <tr key={v.id} className="border-b border-slate-200">
                  <td className="p-2 font-sans font-bold">{doc.title} {doc.versions.length > 1 ? `(v${doc.versions.length - i})` : ''}</td>
                  <td className="p-2">{v.sha256Hash || "N/A"}</td>
                  <td className="p-2">{doc.anchorStatus}</td>
                </tr>
              )))}
            </tbody>
          </table>
          <div className="flex justify-between mt-12 pt-8 border-t border-slate-300">
            <div className="text-center">
              <div className="w-48 border-b border-slate-800 mb-2"></div>
              <p className="text-xs uppercase font-bold">Person in Charge</p>
              <p className="text-[10px] text-slate-500">(of computer system)</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-slate-800 mb-2"></div>
              <p className="text-xs uppercase font-bold">Expert Signatory</p>
              <p className="text-[10px] text-slate-500">(As per BSA 2023 Schedule)</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-slate-800 mb-2"></div>
              <p className="text-xs uppercase font-bold">Date & Seal</p>
            </div>
          </div>
        </div>

        <div className="page-break-before print:break-before-page"></div>

        {/* Master Chain of Custody */}
        <div className="mt-8 break-inside-avoid">
          <h3 className="font-bold uppercase border-b border-slate-300 pb-2 mb-4">Consolidated Chain of Custody Record</h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2">Date/Time</th>
                <th className="p-2">Document</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Transferred To</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {caseRecord.documents.flatMap(doc => doc.custodyEvents.map(evt => ({...evt, docTitle: doc.title})))
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .map((evt) => (
                <tr key={evt.id} className="border-b border-slate-200">
                  <td className="p-2 font-mono text-xs">{evt.createdAt.toLocaleString("en-IN")}</td>
                  <td className="p-2 font-bold">{evt.docTitle}</td>
                  <td className="p-2">{evt.actor.name} ({evt.actor.department})</td>
                  <td className="p-2">{evt.toDepartment}</td>
                  <td className="p-2">{evt.reason}</td>
                </tr>
              ))}
              {caseRecord.documents.every(doc => doc.custodyEvents.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-sm text-slate-500 italic">No custody transfers recorded for any document in this case.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Trail */}
        <div className="mt-8">
          <h3 className="font-bold uppercase border-b border-slate-300 pb-2 mb-4">Case Access & Audit Trail</h3>
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2">Timestamp</th>
                <th className="p-2">Action</th>
                <th className="p-2">Role</th>
                <th className="p-2">Result</th>
                <th className="p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-200">
                  <td className="p-2">{log.createdAt.toLocaleString("en-IN")}</td>
                  <td className="p-2 font-bold">{log.action}</td>
                  <td className="p-2">{log.role}</td>
                  <td className={`p-2 ${log.result === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>{log.result}</td>
                  <td className="p-2">{log.ip ? log.ip.replace(/(\d+)\.\d+$/, "$1.***") : "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-slate-500 font-mono border-t border-slate-300 pt-4 print:fixed print:bottom-0 print:w-full">
          NyayaVault Master Bundle • Generated on {new Date().toISOString()} • End of Report
        </div>

      </div>

      {/* Script for printing via the button */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.getElementById('print-btn').addEventListener('click', async function() {
            try {
              await fetch('/api/cases/${caseRecord.id}/export-bundle-audit', { method: 'POST' });
            } catch (e) {
              console.error(e);
            }
            window.print();
          });
        `
      }} />
    </div>
  );
}
