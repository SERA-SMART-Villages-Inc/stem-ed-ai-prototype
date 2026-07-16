import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database.types";
import type { Profile } from "@/types/schemas";
import mockProfiles from "@/mocks/data/profiles.json";

export const DEV_ROLE_COOKIE = "dev_role";

export type SessionSource = "supabase" | "dev-mock";

export interface ResolvedSession {
  profile: Profile;
  source: SessionSource;
}

const SYNTHETIC_TIMESTAMP = "2025-08-01T00:00:00.000Z";

/**
 * One curated profile id per role for the dev preview — picked deliberately
 * (e.g. a student with an active IEP) rather than "first match in the JSON
 * array", so the preview experience doesn't shift if profiles.json is
 * reordered or extended.
 */
const DEV_ROLE_PREVIEW_ID: Record<AppRole, string> = {
  district_admin: "p0000000-0000-4000-8000-000000000001", // Dana Whitfield
  school_leader: "p0000000-0000-4000-8000-000000000002", // Monica Reyes
  teacher: "p0000000-0000-4000-8000-000000000004", // Priya Shah
  student: "p0000000-0000-4000-8000-000000000009", // Liam Ortiz
};

function findMockProfile(role: AppRole): Profile | null {
  const match = mockProfiles.find((p) => p.id === DEV_ROLE_PREVIEW_ID[role]);
  if (!match) return null;
  return {
    id: match.id,
    role: match.role as AppRole,
    full_name: match.full_name,
    district_id: match.district_id,
    school_id: match.school_id,
    created_at: SYNTHETIC_TIMESTAMP,
    updated_at: SYNTHETIC_TIMESTAMP,
  };
}

/**
 * Resolves the current viewer's profile. Prefers a real Supabase session;
 * falls back to the dev RoleSwitcher's `dev_role` cookie (never in
 * production — mirrors the hard guard in components/dev/RoleSwitcher.tsx)
 * so dashboards are browsable before a live Supabase project is wired up.
 *
 * Phase 2 dashboards always read their data from the mock adapters
 * (lib/services/adapters) regardless of session source — this function only
 * decides *whose* scope (role/district/school) to render.
 */
export async function getCurrentProfile(): Promise<ResolvedSession | null> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profile) {
        return { profile: profile as Profile, source: "supabase" };
      }
    }
  }

  if (process.env.NODE_ENV === "production") return null;

  const devRole = cookies().get(DEV_ROLE_COOKIE)?.value as AppRole | undefined;
  if (!devRole) return null;
  const mock = findMockProfile(devRole);
  return mock ? { profile: mock, source: "dev-mock" } : null;
}

export const ROLE_TO_DASHBOARD_PATH: Record<AppRole, string> = {
  district_admin: "/dashboard/district",
  school_leader: "/dashboard/school",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
};

/** Redirects to /login if no session is resolvable. */
export async function requireProfile(): Promise<Profile> {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  return session.profile;
}

/** Redirects to the caller's own dashboard if their role doesn't match. */
export async function requireRole(role: AppRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) {
    redirect(ROLE_TO_DASHBOARD_PATH[profile.role]);
  }
  return profile;
}

/**
 * Same as requireRole, but returns the full session (profile + source) so
 * callers can tell a real Supabase session from the dev-mock fallback and
 * pick a data adapter accordingly (see lib/services/adapters/resolveAdapter).
 */
export async function requireRoleSession(role: AppRole): Promise<ResolvedSession> {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (session.profile.role !== role) {
    redirect(ROLE_TO_DASHBOARD_PATH[session.profile.role]);
  }
  return session;
}
