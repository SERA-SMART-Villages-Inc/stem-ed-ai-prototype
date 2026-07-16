"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, School, GraduationCap, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { setDevRoleAction } from "@/lib/auth/actions";
import type { AppRole } from "@/types/database.types";

/**
 * DEV-ONLY ROLE SWITCHER
 * ----------------------------------------------------------------------
 * Lets engineers preview each role's dashboard during local development
 * WITHOUT bypassing Supabase RLS. Selecting a role sets a `dev_role`
 * cookie (via a server action) and navigates to that role's dashboard —
 * it does not forge a Supabase session or mutate `profiles.role`. The
 * dashboard's own data reads always go through the mock adapters
 * (lib/services/adapters), which apply the same district/school/teacher
 * scoping RLS would enforce against a real Supabase project.
 *
 * Hard constraints (per CORE CONSTRAINTS #5 — no hardcoded role bypass):
 *   1. Renders nothing unless NODE_ENV !== 'production'.
 *   2. Never mutates `profiles.role` or any Supabase session/JWT claim.
 *   3. Not wired to any data-fetching path that skips RLS — it only
 *      switches which already-permitted mock/query context is requested.
 *   4. This component must be deleted or feature-flagged out before any
 *      production build; the guard below is defense-in-depth, not the
 *      only safeguard (also exclude via bundler in Phase 2 CI check).
 */

const ROLES: { value: AppRole; label: string; icon: typeof Building2 }[] = [
  { value: "district_admin", label: "District Admin", icon: Building2 },
  { value: "school_leader", label: "School Leader", icon: School },
  { value: "teacher", label: "Teacher", icon: GraduationCap },
  { value: "student", label: "Student", icon: User },
];

interface RoleSwitcherProps {
  defaultRole?: AppRole;
}

export function RoleSwitcher({ defaultRole = "teacher" }: RoleSwitcherProps) {
  const [activeRole, setActiveRole] = useState<AppRole>(defaultRole);
  const [isPending, startTransition] = useTransition();

  // Constraint #1: hard production block. No env flag can re-enable this.
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  function handleSelect(role: AppRole) {
    setActiveRole(role);
    startTransition(() => {
      void setDevRoleAction(role);
    });
  }

  return (
    <div
      role="group"
      aria-label="Development role switcher — preview only, not a real permission change"
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-background p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Dev only — preview role</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map(({ value, label, icon: Icon }) => {
          const isActive = value === activeRole;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              disabled={isPending}
              onClick={() => handleSelect(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:opacity-60",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
