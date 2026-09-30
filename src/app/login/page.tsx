import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { NyayaVaultBackground } from "@/components/background/NyayaVaultBackground";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full relative overflow-hidden">
      <NyayaVaultBackground />
      <div className="relative z-10">
        <Suspense fallback={<p className="p-8 text-sm text-slate-600">Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
