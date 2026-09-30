"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X } from "lucide-react";
import { AiAssistant } from "@/components/AiAssistant";

type ViewableCase = {
  id: string;
  caseNumber: string;
  title: string;
};

export function FloatingAssistantClient({
  viewableCases
}: {
  viewableCases: ViewableCase[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(
    viewableCases.length > 0 ? viewableCases[0].id : undefined
  );
  
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative flex items-center" ref={popoverRef}>
      {/* Top Nav Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
          isOpen ? "bg-indigo-100 text-indigo-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        }`}
        title="Global AI Assistant"
      >
        <Bot className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider hidden md:inline">Ask AI</span>
      </button>

      {/* Dropdown Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[450px] shadow-2xl rounded-xl overflow-hidden border border-slate-200 bg-white animate-in slide-in-from-top-2 fade-in duration-200 origin-top-right">
          
          {viewableCases.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white text-sm">
              You are not currently assigned to any cases that permit AI Assistant access.
            </div>
          ) : (
            <div className="flex flex-col h-[550px] max-h-[85vh]">
              {/* Header with Case Selector */}
              <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#0F294D] flex items-center gap-2">
                    <img src="/AI logo.png" alt="AI" className="h-5 w-5 rounded-full object-cover shadow-sm" />
                    Global AI Assistant
                  </h3>
                  <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Context:</label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    className="flex-1 text-xs p-1.5 border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-medium text-slate-700 shadow-sm"
                  >
                    {viewableCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chat Interface */}
              <div className="flex-1 overflow-hidden relative">
                {selectedCaseId ? (
                  <AiAssistant caseId={selectedCaseId} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
