import profiles from "@/mocks/data/profiles.json";

/**
 * Full names live in `profiles` (our own RBAC anchor table), not in the
 * SIS-shaped Teacher/Student domain types the adapters return. This looks
 * up a display name for a profile id from the same synthetic directory the
 * dev-role fallback uses (lib/auth/session.ts).
 */
export function lookupFullName(profileId: string): string {
  const match = profiles.find((p) => p.id === profileId);
  return match?.full_name ?? profileId;
}
