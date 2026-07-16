import type { StudentDataAdapter } from "@/lib/services/StudentDataAdapter";
import type { ResolvedSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MockOneRosterAdapter } from "./MockOneRosterAdapter";
import { MockEdFiAdapter } from "./MockEdFiAdapter";
import { SupabaseStudentDataAdapter } from "./SupabaseStudentDataAdapter";

export type MockDataSource = "oneroster" | "edfi";

export const DEFAULT_DATA_SOURCE: MockDataSource = "oneroster";

/** Both mock adapters describe the same synthetic district — swap freely. */
export function getAdapter(source: MockDataSource = DEFAULT_DATA_SOURCE): StudentDataAdapter {
  switch (source) {
    case "edfi":
      return new MockEdFiAdapter();
    case "oneroster":
    default:
      return new MockOneRosterAdapter();
  }
}

/**
 * Picks the data adapter for a dashboard page based on how the viewer's
 * session was resolved: a real Supabase session reads the live database
 * (RLS-enforced), while the dev RoleSwitcher cookie fallback keeps reading
 * the mock OneRoster/Ed-Fi JSON so local dev works with no Supabase project.
 */
export async function resolveAdapter(session: ResolvedSession, mockSourceParam?: string): Promise<StudentDataAdapter> {
  if (session.source === "supabase") {
    return new SupabaseStudentDataAdapter(createServerSupabaseClient());
  }
  const source: MockDataSource = mockSourceParam === "edfi" ? "edfi" : DEFAULT_DATA_SOURCE;
  return getAdapter(source);
}

export { MockOneRosterAdapter, MockEdFiAdapter, SupabaseStudentDataAdapter };
