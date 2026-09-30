import React from "react";
import { Landmark } from "lucide-react";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  quote?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, quote, action }: PageHeaderProps) {
  return (
    <div className="relative mb-8 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
      


      <div className="relative z-10 max-w-2xl">
        <h1 className="font-serif text-[42px] leading-[1.1] font-bold text-[#0F294D] tracking-tight">{title}</h1>
        {subtitle && (
          <div className="mt-3 text-base text-slate-500 font-medium">{subtitle}</div>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-end gap-4 shrink-0 pt-2">

        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
