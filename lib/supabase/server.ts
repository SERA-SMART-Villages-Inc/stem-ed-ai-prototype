import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import type { Database } from "@/types/database.types";

/**
 * Server client — reads the user's session from cookies so RLS applies
 * exactly as it would for the browser client. Use in Server Components,
 * Route Handlers, and Server Actions only.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();
  const env = getEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

/**
 * Service-role client. SERVER-ONLY. Bypasses RLS entirely.
 * Guarded so it throws immediately if ever imported into a client bundle,
 * and throws if the key is absent (local/dev without admin tasks).
 *
 * Restrict usage to trusted server-side jobs in /lib/services
 * (e.g., nightly sync jobs) — never call from a Route Handler that
 * forwards arbitrary user input without its own authorization check.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient must never be called from client code.");
  }
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  // Lazy import so the service client (and its key) can never end up in a client bundle.
  const supabaseJs = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return supabaseJs.createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
