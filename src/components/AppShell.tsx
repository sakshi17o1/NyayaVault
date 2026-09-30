"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { CaseSwitcher } from "@/components/CaseSwitcher";
import { DemoBanner } from "@/components/DemoBanner";
import type { Role } from "@prisma/client";
import {
  Home, Folder, Upload, Search, FileText, Shield,
  Fingerprint, Scale, BarChart, Bot, Settings, Share2,
  Bell, ChevronDown, AlertCircle, ShieldAlert, ArrowRightLeft, FileWarning, Menu, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import logoImage from "../../public/logo.png";

const ALL_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/cases", label: "Cases", icon: Folder },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/search", label: "Search", icon: Search },
  { href: "/custody", label: "Custody", icon: Shield },
  { href: "/integrity", label: "Integrity", icon: Fingerprint },
  { href: "/court-bundle", label: "Court bundle", icon: Scale },
  { href: "/audit", label: "Audit", icon: BarChart },
  { href: "/share", label: "Share", icon: Share2 },
];

function getNavForRole(role: Role) {
  switch (role) {
    case "IO":
      return ALL_NAV.filter(n => ["/dashboard", "/cases", "/upload", "/search", "/custody", "/integrity", "/share"].includes(n.href));
    case "SHO":
      return ALL_NAV.filter(n => ["/dashboard", "/cases", "/upload", "/search", "/custody", "/integrity", "/audit", "/share"].includes(n.href));
    case "FORENSIC_EXPERT":
      return ALL_NAV.filter(n => ["/dashboard", "/cases", "/upload", "/custody", "/integrity"].includes(n.href));
    case "PROSECUTOR":
      return ALL_NAV.filter(n => ["/dashboard", "/cases", "/search", "/custody", "/integrity", "/court-bundle"].includes(n.href));
    case "JUDGE_AUDITOR":
      return ALL_NAV.filter(n => ["/cases", "/integrity", "/custody", "/audit", "/court-bundle"].includes(n.href));
    case "ADMIN":
      return ALL_NAV.filter(n => ["/audit"].includes(n.href));
    default:
      return [];
  }
}

import { NyayaVaultBackground } from "@/components/background/NyayaVaultBackground";

export function AppShell({
  children,
  user,
  floatingAssistant,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: Role };
  floatingAssistant?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          const newNotifs = data.notifications || [];
          
          setNotifications(prev => {
            if (prev.length > 0 && newNotifs.length > 0) {
              const newItems = newNotifs.filter((n: any) => !prev.some(p => p.id === n.id));
              if (newItems.length > 0 && !showNotifs) {
                setUnreadCount(count => count + newItems.length);
              }
            }
            return newNotifs;
          });
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    }

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [showNotifs]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Generate initials for avatar
  const initials = user.email.substring(0, 2).toUpperCase();
  const userName = user.name || "Kavya Mehra";

  const roleDisplayMap: Record<Role, string> = {
    IO: "Investigating Officer",
    SHO: "Station House Officer",
    FORENSIC_EXPERT: "Forensic Expert",
    PROSECUTOR: "Prosecutor",
    JUDGE_AUDITOR: "Judge / Auditor",
    ADMIN: "System Admin",
  };

  const getIcon = (name: string, className: string) => {
    switch (name) {
      case "AlertCircle": return <AlertCircle className={className} />;
      case "ShieldAlert": return <ShieldAlert className={className} />;
      case "ArrowRightLeft": return <ArrowRightLeft className={className} />;
      case "FileWarning": return <FileWarning className={className} />;
      default: return <Bell className={className} />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-800">
      <NyayaVaultBackground clean={true} />
      <DemoBanner />

      {/* Top App Bar (Full Width) */}
      <header className="fixed top-0 inset-x-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md">

        <div className="flex lg:w-64 items-center pl-4 lg:pl-6 gap-2 mt-1">
          <button 
            className="lg:hidden p-1 mr-1 text-slate-600 hover:text-navy transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-col justify-center gap-0.5">
            <Image src={logoImage} alt="NyayaVault" width={240} height={80} className="w-[140px] lg:w-[190px] h-auto drop-shadow-sm" unoptimized />
          </div>
        </div>

        {/* Middle: Search */}
        <div className="flex-1 px-2 lg:px-8 hidden md:block">
          <form 
            className="relative w-full max-w-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
              if (q.trim()) {
                router.push(`/search?q=${encodeURIComponent(q.trim())}`);
              }
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="text"
              placeholder="Search cases, documents, FIR numbers, or OCR text..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-4 text-base font-bold text-black outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:font-normal placeholder:text-slate-400"
            />
          </form>
        </div>

        {/* Right: Profile Actions */}
        <div className="flex items-center gap-6 pr-6">
          {/* Active Case / Workspace Badge */}
          {user.role !== "ADMIN" && <CaseSwitcher />}
          
          {/* Global AI Assistant */}
          {floatingAssistant}

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs) setUnreadCount(0);
              }}
              className="relative text-black hover:text-slate-700 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[8px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-4 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#0F294D]">Notifications</h4>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="flex gap-3">
                          <div className={`h-8 w-8 rounded-full bg-${notif.color}-50 flex items-center justify-center shrink-0 mt-1`}>
                            {getIcon(notif.icon, `h-4 w-4 text-${notif.color}-600`)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0F294D] mb-1">{notif.title}</p>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{notif.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">
                              {formatDistanceToNow(new Date(notif.time), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 text-center border-t border-slate-100 bg-slate-50 rounded-b-xl">
                  <Link href="/notifications" className="block text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors w-full py-1">View all notifications</Link>
                </div>
              </div>
            )}
          </div>


          {/* Subtle sign out / switch role */}
          <div className="border-l border-slate-200 pl-4 flex flex-col gap-1 items-start">
            <RoleSwitcher currentEmail={user.email} />
            <button onClick={logout} className="text-xs font-bold text-black hover:text-red-600 underline ml-1 transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`fixed bottom-0 left-0 top-16 z-50 flex w-64 flex-col bg-white/95 lg:bg-white/80 backdrop-blur-md border-r border-slate-200 transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex justify-between items-center lg:hidden px-6 py-4 border-b border-slate-100">
          <span className="font-bold text-[#0F294D]">Menu</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 hover:text-[#0F294D]">
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto py-6">
          {getNavForRole(user.role).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${active
                  ? "bg-[#0F294D] text-white"
                  : "text-slate-700 hover:bg-slate-200/50 hover:text-[#0F294D]"
                  }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user.role === "ADMIN" && (
          <div className="mt-auto p-4">
            <Link href="/admin" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#F0F4F8] p-4 text-sm hover:bg-slate-200 transition-colors group">
              <Settings className="h-6 w-6 flex-shrink-0 text-[#0F294D] group-hover:rotate-90 transition-transform duration-300" />
              <div>
                <p className="font-semibold text-[#0F294D]">System Configuration</p>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-slate-500 text-xs">
                  Manage settings & users
                </div>
              </div>
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="ml-0 lg:ml-64 pt-16 min-h-screen relative overflow-hidden transition-all duration-300">
        {/* We move the fading building illustration to the PageHeader or wrap it here if it's on every page. 
            Since it appears on the dashboard and other pages, we will implement it in PageHeader for cleaner scoping. */}
        <div className="relative z-10 p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
