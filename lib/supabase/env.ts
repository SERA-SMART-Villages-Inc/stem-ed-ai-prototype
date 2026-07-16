import { z } from "zod";

/**
 * Fail fast on missing/malformed env config rather than surfacing
 * opaque Supabase client errors at request time.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // server-only; never bundled client-side
});

function readRawEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * True once real Supabase credentials are present. Phase 2 dashboards run
 * on mock adapters regardless, but auth pages/middleware use this to decide
 * whether to attempt a real Supabase session or fall back to the dev
 * RoleSwitcher cookie — so the app runs before a live project exists.
 */
export function isSupabaseConfigured(): boolean {
  return envSchema
    .pick({ NEXT_PUBLIC_SUPABASE_URL: true, NEXT_PUBLIC_SUPABASE_ANON_KEY: true })
    .safeParse(readRawEnv()).success;
}

let cached: z.infer<typeof envSchema> | null = null;

/** Parses lazily so importing the Supabase client tree is safe pre-configuration. */
export function getEnv() {
  if (!cached) {
    cached = envSchema.parse(readRawEnv());
  }
  return cached;
}
