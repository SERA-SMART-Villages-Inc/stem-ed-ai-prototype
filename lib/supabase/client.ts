"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "./env";
import type { Database } from "@/types/database.types";

/**
 * Browser client — always authenticates as the signed-in user.
 * Every query through this client is subject to RLS policies in
 * supabase/migrations/0001_init_schema.sql. Never import the
 * service role key here.
 */
export function createClient() {
  const env = getEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
