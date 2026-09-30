import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Folder, Shield, AlertTriangle, ArrowRight, User, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const roleDisplayMap: Record<string, string> = {
    IO: "Investigating Officer",
    SHO: "Station House Officer",
    FORENSIC_EXPERT: "Forensic Expert",
    PROSECUTOR: "Prosecutor",
    JUDGE_AUDITOR: "Judge / Auditor",
    ADMIN: "System Admin",
  };
  const displayRole = roleDisplayMap[user.role] || user.role;


  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    include: { case: true },
  });

  const deniedCount = await prisma.auditLog.count({
    where: { action: "ACCESS_DENIED" },
  });

  const anchoredCount = await prisma.document.count({
    where: { anchorStatus: "ANCHORED" }
  });

  const restricted = await prisma.caseRecord.findUnique({
    where: { caseNumber: "WS-2026-0001" },
  });
  const assignedToRestricted = assignments.some((row) => row.case.caseNumber === "WS-2026-0001");

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Main Content Area */}
      <div className="lg:col-span-2 space-y-6">
        <PageHeader 
          title={<>Welcome back, {user.name ? user.name.split(' ')[0] : 'Kavya'}!</>}
          subtitle="Here's your operational overview for NyayaVault."
          quote={"Evidence Today,\nJustice Tomorrow."}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden min-h-[220px] flex flex-col bg-white">
            <CardContent className="p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Folder className="h-7 w-7" />
                </div>
                <Link href="/cases" className="h-8 w-8 bg-slate-50 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors cursor-pointer">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div>
                <p className="text-base font-bold text-[#0F294D] mb-2">Assigned cases</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-[#0F294D] tracking-tight">{assignments.length}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Cases assigned to you</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden min-h-[220px] flex flex-col bg-white">
            <CardContent className="p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <Shield className="h-7 w-7" />
                </div>
                <Link href="/integrity" className="h-8 w-8 bg-slate-50 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-100 transition-colors cursor-pointer">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div>
                <p className="text-base font-bold text-[#0F294D] mb-2">Integrity status</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-[#0F294D] tracking-tight">{anchoredCount}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Hash-anchored documents</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden min-h-[220px] flex flex-col bg-white">
            <CardContent className="p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="h-14 w-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <Link href="/audit" className="h-8 w-8 bg-slate-50 rounded-full flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors cursor-pointer">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div>
                <p className="text-base font-bold text-[#0F294D] mb-2">Denied access events</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-[#0F294D] tracking-tight">{deniedCount}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Append-only audit</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 bg-white p-5 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-[#0F294D] flex items-center gap-2">
              <Folder className="h-6 w-6 text-slate-400" /> Assigned case list
            </CardTitle>
            <Link href="/cases" className="text-sm font-semibold text-white bg-[#0F294D] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#0F294D]/90 transition-colors">
              View all cases <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {assignments.length === 0 ? (
                <p className="p-8 text-sm text-slate-500 text-center font-medium">No case assignments for this demo identity.</p>
              ) : (
                assignments.map((row) => (
                  <Link
                    key={row.id}
                    href={`/cases/${row.case.id}`}
                    className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileTextIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-lg font-bold text-[#0F294D]">{row.case.caseNumber}</p>
                        </div>
                        <p className="text-base text-slate-600 font-medium">{row.case.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><MapPinIcon className="h-4 w-4" /> {row.case.station}</span>
                          <span>·</span>
                          <span>Purpose: {row.purpose}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <Badge className="bg-[#0F294D] text-white text-xs uppercase font-bold tracking-wider rounded border-none px-2 py-1">{row.case.classification}</Badge>
                       <ArrowRight className="h-6 w-6 text-slate-300 group-hover:text-[#0F294D] transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar Context Panels */}
      <div className="space-y-6 pt-16 mt-2">
        
        {/* Current Role Card */}
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-5 pb-4">
             <CardTitle className="text-lg font-bold text-[#0F294D] flex items-center gap-2">
                <User className="h-5 w-5 text-slate-500" /> Current Role
             </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg border border-blue-100">
              {user.email.substring(0,2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-base text-[#0F294D] uppercase tracking-wide text-[14px]">{displayRole} — {user.name || "Kavya Mehra"}</p>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-bold text-xs px-2 py-0.5">Active</Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1">Official ID: {user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Role Capabilities Card */}
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-5 pb-4">
             <CardTitle className="text-lg font-bold text-[#0F294D] flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-500" /> Role Capabilities
             </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-600 mb-2">
                As a <strong className="text-[#0F294D]">{user.role.replace('_', ' ')}</strong>, you are authorized to perform the following tasks:
              </p>
              <ul className="space-y-3">
                {user.role === "IO" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Upload evidence and documents to assigned cases</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> View and manage documents within your assigned cases</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Initiate custody transfers of physical evidence</li>
                  </>
                )}
                {user.role === "SHO" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Assign cases to Investigating Officers (IO)</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Review and approve AI-extracted OCR metadata</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Oversee all cases within your police station</li>
                  </>
                )}
                {user.role === "FORENSIC_EXPERT" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Upload and sign forensic reports and analysis</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> View assigned evidence requiring forensic examination</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Verify cryptographic integrity of received documents</li>
                  </>
                )}
                {user.role === "PROSECUTOR" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Compile and export court-ready document bundles</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> View all filed case documents for prosecution</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Share secure, time-limited viewing links with courts</li>
                  </>
                )}
                {user.role === "JUDGE_AUDITOR" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Read-only access to case files and evidence</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Verify hash-chain integrity of submitted documents</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Review immutable access and custody audit logs</li>
                  </>
                )}
                {user.role === "ADMIN" && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Manage user accounts, roles, and station assignments</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> Configure system-wide access policies and classifications</li>
                    <li className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> View raw system audit logs and ledger events</li>
                  </>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {restricted && !assignedToRestricted && (
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white overflow-hidden">
             <CardHeader className="border-b border-slate-100 p-4 pb-3">
               <CardTitle className="text-sm font-bold text-red-600 flex items-center gap-2">
                 <AlertTriangle className="h-4 w-4" /> Restricted Area Demo
               </CardTitle>
             </CardHeader>
             <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-600 mb-3 leading-relaxed">
                  You are not assigned to WS-2026-0001. Opening it must fail and write an immutable <code>ACCESS_DENIED</code> event.
                </p>
                <Link className="inline-flex items-center gap-1 font-bold text-xs text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors" href={`/cases/${restricted.id}`}>
                  Attempt restricted access <ArrowRight className="h-3 w-3" />
                </Link>
             </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

// Icons
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
}

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
}
