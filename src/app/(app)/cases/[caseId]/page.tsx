import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateSummaryButton } from "./GenerateSummaryButton";
import { ApproveSummaryButton } from "./ApproveSummaryButton";
import { DocumentActions } from "@/components/DocumentActions";
import { formatClassification } from "@/lib/utils/format";
import { PhysicalExhibitsList } from "@/components/PhysicalExhibitsList";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { caseId } = await params;

  const result = await authorizeCase({
    user,
    caseId,
    action: "view_case",
  });

  if (result.status === 404) notFound();

  if (!result.ok) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge tone="red">Denied and logged</Badge>
          <p className="text-sm text-slate-700">{result.reason}</p>
          <p className="text-xs text-slate-500">
            This event is written to the append-only audit log. Use the Auditor account to open
            Audit.
          </p>
        </CardContent>
      </Card>
    );
  }

  const record = result.case;
  
  const documents = await prisma.document.findMany({
    where: { 
      caseId: record.id,
      ownerDepartment: user.department || undefined
    },
    orderBy: { createdAt: "desc" },
  });

  const latestAiSummary = await prisma.aiSummary.findFirst({
    where: { caseId: record.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Fictional case</p>
          <h1 className="font-serif text-3xl text-navy">{record.caseNumber}</h1>
          <p className="text-slate-600">{record.title}</p>
        </div>
        <Badge>{formatClassification(record.classification)}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Case metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Station: {record.station}</p>
            <p>Status: {record.status}</p>
            <p>FIR: {record.firNumber}</p>
            <p>CCTNS mock ref: {record.cctnsRef}</p>
            <p className="text-xs text-slate-500">{record.fictionalNote}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integrity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">

            <p className="text-sm text-slate-600">
              SHA-256 hashing and AES-256 encryption active. Ledger chains are being built.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Summary (Official)</CardTitle>
          <div className="flex items-center gap-2">
            <GenerateSummaryButton caseId={caseId} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{record.summary}</p>
        </CardContent>
      </Card>
      
      {latestAiSummary && latestAiSummary.status === "UNVERIFIED" && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-indigo-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">AI GENERATED</span>
                AI Case Analysis
                {latestAiSummary.status === "UNVERIFIED" && <span className="text-xs font-normal opacity-70 ml-2">(Unverified)</span>}
              </div>
              {latestAiSummary.status === "UNVERIFIED" && (
                <ApproveSummaryButton caseId={caseId} summaryId={latestAiSummary.id} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-indigo-900/80 italic">{latestAiSummary.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-600">
              No documents uploaded yet. Go to <Link href="/upload" className="text-navy underline">Upload</Link> to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                  <div>
                    <p className={`font-medium ${doc.status === "ARCHIVED" ? "text-red-600" : "text-navy"}`}>
                      {doc.title} {doc.status === "ARCHIVED" && <span className="text-xs font-bold">(ARCHIVED)</span>}
                    </p>
                    <p className="text-xs text-slate-500">Type: {doc.type} | Version: {doc.currentVersion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="slate">{doc.status}</Badge>
                    <DocumentActions docId={doc.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <PhysicalExhibitsList caseId={caseId} />
    </div>
  );
}
