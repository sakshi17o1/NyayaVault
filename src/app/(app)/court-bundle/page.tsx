import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Folder, Scale } from "lucide-react";

export default async function CourtBundlePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    include: {
      case: {
        include: {
          _count: {
            select: { documents: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const cases = assignments.map(a => a.case);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Court Bundle & Integrity Report</h1>
        <p className="text-sm text-slate-600">
          Select a case below to generate its master cryptographic integrity report and compiled court bundle.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Case Number</th>
              <th className="px-4 py-3">Case Title</th>
              <th className="px-4 py-3">Total Documents</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  You are not assigned to any cases.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-slate-400" />
                      {c.caseNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.title}</td>
                  <td className="px-4 py-3 text-slate-600">{c._count.documents} files</td>
                  <td className="px-4 py-3 text-right">
                    <Link 
                      href={`/court-bundle/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded hover:bg-navy/90 transition-colors"
                    >
                      <Scale className="h-3.5 w-3.5" />
                      Generate Master Bundle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
