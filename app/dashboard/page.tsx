import { redirect } from "next/navigation";
import { requireProfile, ROLE_TO_DASHBOARD_PATH } from "@/lib/auth/session";

export default async function DashboardIndexPage() {
  const profile = await requireProfile();
  redirect(ROLE_TO_DASHBOARD_PATH[profile.role]);
}
