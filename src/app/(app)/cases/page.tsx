import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { CreateCaseModal } from "@/components/CreateCaseModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Search, Folder, Calendar, MapPin, ChevronRight, FileText, Filter, List, LayoutGrid } from "lucide-react";
import { formatClassification } from "@/lib/utils/format";

export default async function CasesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    include: { 
      case: {
        include: { documents: true }
      } 
    },
  });

  const cases = assignments.filter((row) =>
    evaluateAccess({
      role: user.role,
      assigned: true,
      caseClassification: row.case.classification,
      action: "view_case",
    }).allowed,
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Cases" 
        subtitle="Server-filtered to your assignments. Cross-case access is denied and logged."
        quote={"Justice\nThrough\nTrusted Evidence."}
        action={<CreateCaseModal />}
      />

      {/* Mocked Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by case ID, title, FIR number..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
          />
        </div>
        
        <select className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 pr-8 focus:outline-none appearance-none">
          <option>All Status</option>
        </select>
        
        <select className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 pr-8 focus:outline-none appearance-none">
          <option>All Roles</option>
        </select>

        <select className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 pr-8 focus:outline-none appearance-none">
          <option>All Locations</option>
        </select>
        
        <button className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold px-4 py-2 rounded-lg transition-colors border border-slate-200">
          <Filter className="h-4 w-4" /> Reset
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[#0F294D] text-lg font-bold">
              <Folder className="h-5 w-5" /> Visible cases ({cases.length})
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Sort by</span>
                <select className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded px-2 py-1.5 focus:outline-none shadow-sm appearance-none pr-6">
                  <option>Last Updated</option>
                </select>
              </div>
              <div className="flex gap-1">
                <button className="h-8 w-8 bg-[#0F294D] text-white rounded flex items-center justify-center shadow-sm">
                  <List className="h-4 w-4" />
                </button>
                <button className="h-8 w-8 bg-white border border-slate-200 text-slate-400 hover:text-[#0F294D] rounded flex items-center justify-center shadow-sm transition-colors">
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {cases.length === 0 ? (
              <div className="p-12 text-center">
                <Folder className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">No cases visible for this role/classification.</p>
              </div>
            ) : (
              cases.map((row) => (
                <div key={row.case.id} className="p-6 hover:bg-blue-50/20 transition-colors group relative flex flex-col md:flex-row gap-6 items-center">
                  
                  <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="h-8 w-8" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-bold text-lg text-[#0F294D]">{row.case.caseNumber}</span>
                      <Badge className="bg-[#FFF8E6] text-[#B8860B] hover:bg-[#FFF8E6] border-none px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">{row.case.status}</Badge>
                      <Badge className="bg-[#0F294D] text-white hover:bg-[#0F294D]/90 border-none px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">{formatClassification(row.case.classification)}</Badge>
                    </div>
                    
                    <p className="text-slate-700 font-medium mb-3 text-sm">{row.case.title}</p>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-medium">
                      <span className="text-slate-500">FIR {row.case.firNumber}</span>
                      <span>·</span>
                      <span className="text-slate-500">CCTNS mock {row.case.cctnsRef}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-medium mt-2">
                      <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {row.case.station}</span>
                      <span className="flex items-center gap-1.5 border-l border-slate-200 pl-4"><Calendar className="h-3 w-3" /> Filed: 12 Jan 2026</span>
                      <span className="flex items-center gap-1.5 border-l border-slate-200 pl-4"><ClockIcon className="h-3 w-3" /> Updated: 2 hours ago</span>
                    </div>

                  </div>

                  <div className="flex items-center shrink-0">
                    <Link 
                      href={`/cases/${row.case.id}`} 
                      className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors border border-blue-100"
                    >
                      View Details <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
        <div className="bg-white border-t border-slate-100 p-5 text-xs text-slate-500 font-medium flex justify-between items-center rounded-b-xl">
          <span>Showing {cases.length} of {cases.length} case{cases.length !== 1 && 's'}</span>
          <div className="flex gap-2">
            <button className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400" disabled>&lt;</button>
            <button className="h-8 w-8 flex items-center justify-center rounded-md border border-[#0F294D] bg-[#0F294D] text-white font-bold">1</button>
            <button className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400" disabled>&gt;</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
