"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastMethods = {
    success: (message: string) => addToast("success", message),
    error: (message: string) => addToast("error", message),
    warning: (message: string) => addToast("warning", message),
    info: (message: string) => addToast("info", message),
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Simple entry animation using tailwind-animate-in (assuming global support, else fallback)
  const baseClasses = "flex items-start p-4 rounded-lg shadow-lg border pointer-events-auto transition-all animate-in slide-in-from-right-8 fade-in duration-300";
  
  let typeClasses = "";
  let Icon = Info;
  
  switch (toast.type) {
    case "success":
      typeClasses = "bg-green-50 border-green-200 text-green-900";
      Icon = CheckCircle2;
      break;
    case "error":
      typeClasses = "bg-red-50 border-red-200 text-red-900";
      Icon = AlertCircle;
      break;
    case "warning":
      typeClasses = "bg-amber-50 border-amber-200 text-amber-900";
      Icon = AlertTriangle;
      break;
    case "info":
      typeClasses = "bg-slate-50 border-slate-200 text-slate-900";
      Icon = Info;
      break;
  }

  return (
    <div className={cn(baseClasses, typeClasses)}>
      <Icon className={cn("h-5 w-5 mr-3 mt-0.5 shrink-0", 
        toast.type === 'success' ? 'text-green-600' :
        toast.type === 'error' ? 'text-red-600' :
        toast.type === 'warning' ? 'text-amber-600' :
        'text-slate-600'
      )} />
      <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
      <button 
        onClick={onDismiss}
        className="ml-1 shrink-0 opacity-50 hover:opacity-100 transition-opacity p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
