"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DEV_ROLE_COOKIE, ROLE_TO_DASHBOARD_PATH } from "./session";
import type { AppRole } from "@/types/database.types";

const APP_ROLES: readonly AppRole[] = ["district_admin", "school_leader", "teacher", "student"];

/** Sets the dev-only role preview cookie. Never available in production. */
export async function setDevRoleAction(role: AppRole) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev role switcher is disabled in production.");
  }
  if (!APP_ROLES.includes(role)) {
    throw new Error("Unknown role.");
  }
  cookies().set(DEV_ROLE_COOKIE, role, { path: "/", maxAge: 60 * 60 * 8 });
  redirect(ROLE_TO_DASHBOARD_PATH[role]);
}

export async function signOutAction() {
  cookies().delete(DEV_ROLE_COOKIE);
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export interface SignInState {
  error: string | null;
}

export async function signInWithPasswordAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase isn't configured in this environment yet. Use the dev role preview below instead." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message ?? "Invalid email or password." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(profile ? ROLE_TO_DASHBOARD_PATH[profile.role as AppRole] : "/dashboard");
}
