import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { RoleSwitcher } from "@/components/dev/RoleSwitcher";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in — K-12 Insights Dashboard",
};

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">K-12 Insights Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with your district-issued account.</p>
      </div>

      {configured ? (
        <LoginForm />
      ) : (
        <div className="w-full max-w-sm rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
          Supabase isn&apos;t configured in this environment yet. Use the dev role preview in the corner to browse
          each dashboard on synthetic data.
        </div>
      )}

      <RoleSwitcher />
    </main>
  );
}
