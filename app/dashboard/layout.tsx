import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { RoleSwitcher } from "@/components/dev/RoleSwitcher";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { AppRole } from "@/types/database.types";

const ROLE_LABELS: Record<AppRole, string> = {
  district_admin: "District Admin",
  school_leader: "School Leader",
  teacher: "Teacher",
  student: "Student",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const { profile } = session;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">K-12 Insights Dashboard</p>
            <p className="font-medium">{profile.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{ROLE_LABELS[profile.role]}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
      <RoleSwitcher defaultRole={profile.role} />
    </div>
  );
}
