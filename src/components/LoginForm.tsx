"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, ShieldCheck, Link2, Bot, Info, ArrowRight, User, Landmark } from "lucide-react";

const ACCOUNTS = [
  { name: "Mehra", email: "io.mehra@nyayavault.demo", role: "Investigating Officer" },
  { name: "Kapoor", email: "sho.kapoor@nyayavault.demo", role: "Station House Officer" },
  { name: "Nair", email: "forensic.nair@nyayavault.demo", role: "Forensic Expert" },
  { name: "Sharma", email: "pp.sharma@nyayavault.demo", role: "Prosecutor" },
  { name: "Iyer", email: "auditor.iyer@nyayavault.demo", role: "Judge / Auditor" },
  { name: "System", email: "admin@nyayavault.demo", role: "Admin" },
  { name: "Unassigned", email: "io.unassigned@nyayavault.demo", role: "IO (Other Case)" },
];

import logoImage from "../../public/logo.png";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("io.mehra@nyayavault.demo");
  const [password, setPassword] = useState("demo1234!");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [mfa, setMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, otp: mfa ? otp : undefined }),
    });
    const data = await response.json();
    setBusy(false);
    if (data.mfaRequired) {
      setMfa(true);
      return;
    }
    if (!response.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">

      {/* LEFT SIDE: Branding and info (Z-INDEX 10) */}
      <div className="relative p-10 lg:p-20 xl:p-28 flex flex-col justify-center z-[10]">

        <div className="relative z-[10]">
          {/* Logo & Header */}
          <div className="mb-12 flex flex-col items-start gap-2">
            <Image src={logoImage} alt="NyayaVault" width={1000} height={1000} className="w-auto h-24 drop-shadow-md" unoptimized />
          </div>

          {/* Tagline */}
          <h2 className="font-serif text-[42px] md:text-[40px] font-bold leading-tight tracking-tight mb-6">
            <span className="text-[#0F294D] block">Secure Evidence.</span>
            <span className="text-blue-600 block">Stronger Justice.</span>
          </h2>

          <p className="text-base text-slate-600 text-justify font-semibold leading-relaxed max-w-md mb-8">
            Court-ready evidence-document intelligence: encrypted off-chain storage, hash-chain integrity, chain of custody, and a local AI assistant. This prototype is not CCTNS, ICJS, or e-Courts.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 h-24">
              <Lock className="h-6 w-6 text-blue-600 mb-2" />
              <span className="text-[13px] font-bold text-[#0F294D] leading-tight">Encrypted<br />Storage</span>
            </div>
            <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 h-24">
              <ShieldCheck className="h-6 w-6 text-blue-600 mb-2" />
              <span className="text-[13px] font-bold text-[#0F294D] leading-tight">Hash-chain<br />Integrity</span>
            </div>
            <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 h-24">
              <Link2 className="h-6 w-6 text-blue-600 mb-2" />
              <span className="text-[13px] font-bold text-[#0F294D] leading-tight">Chain of<br />Custody</span>
            </div>
            <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 h-24">
              <Bot className="h-6 w-6 text-blue-600 mb-2" />
              <span className="text-[13px] font-bold text-[#0F294D] leading-tight">Case<br />Assistant</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-4 max-w-md mt-12">
            <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <p className="text-base font-bold text-blue-900 mb-1">Password for all demo accounts: demo1234!</p>
              <p className="text-base font-bold text-blue-800 mb-2">Demo OTP: 000000</p>
              <p className="text-slate-600 text-base font-semibold">Use the unassigned IO to show a denied, audited access attempt.</p>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT SIDE: Login Form (Z-INDEX 20) */}
      <div className="relative p-8 lg:p-12 xl:p-20 flex flex-col justify-center items-center z-[20]">

        {/* Top Right Status Badge */}
        <div className="absolute top-6 right-6 lg:top-10 lg:right-10 z-[50] flex flex-col items-end">
          <div className="bg-[#0F294D]/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg border border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            Demo Prototype
          </div>
          <p className="text-[9px] text-white mt-1.5 font-bold tracking-widest uppercase">Not a live government system</p>
        </div>
        {/* Login Card Container */}
        <div className="w-full max-w-md relative z-[30] bg-white rounded-[24px] p-8 md:p-12 shadow-sm border border-slate-100">

          {/* Form Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-[#0F294D]">Secure sign-in</h3>
              <p className="text-sm text-slate-500">Access your NyayaVault demo account</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-[#0F294D]">Demo account ID</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold text-[#0F294D]">Password</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 bg-slate-50 border-slate-200 focus:bg-white text-lg tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {mfa ? (
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-xs font-bold text-[#0F294D]">MFA OTP (demo)</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  required
                  className="h-12 bg-slate-50"
                />
              </div>
            ) : null}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <Button type="submit" disabled={busy} className="w-full h-12 bg-[#0F294D] hover:bg-[#0F294D]/90 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2">
              {busy ? "Signing in…" : mfa ? "Verify OTP" : "Continue"} {!busy && !mfa && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Demo Accounts Selector */}
          <div className="mt-8 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px bg-slate-200 flex-1"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 whitespace-nowrap">
                <User className="h-3 w-3" /> DEMO IDENTITY
              </p>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <select
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm font-medium text-[#0F294D] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors cursor-pointer"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMfa(false);
                setOtp("");
              }}
            >
              {ACCOUNTS.map((item) => (
                <option key={item.email} value={item.email}>
                  {item.role} — {item.name}
                </option>
              ))}
            </select>
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-500 font-mono">{email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
