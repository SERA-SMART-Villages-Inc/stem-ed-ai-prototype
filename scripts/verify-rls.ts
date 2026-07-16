/**
 * Adversarially verifies that Postgres RLS — not just the app's own query
 * scoping — actually blocks cross-school/cross-role access. Signs in as
 * several of the real test accounts (created by `npm run seed`) using the
 * anon key + their password, then issues queries the app itself would
 * never construct (e.g. a teacher explicitly filtering by another school's
 * id) directly against PostgREST.
 *
 * RUN THIS YOURSELF: `npm run verify:rls`
 *
 * Needs the same test accounts/password as scripts/seed.ts — run that
 * first. Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (never the service role key — the whole point is to prove RLS holds
 * under a normal, non-privileged session).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD ?? "Riverbend-Test-2026!";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. Aborting.");
  process.exit(1);
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL as string, ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error || !data.session) {
    throw new Error(
      `Failed to sign in as ${email}: ${error?.message ?? "no session"}. ` +
        `Did you run \`npm run seed\` first, and does SEED_TEST_PASSWORD (if you set one) match?`
    );
  }
  return client;
}

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}
const results: CheckResult[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      ${detail}`);
}

async function main() {
  console.log("== RLS adversarial verification ==\n");

  // 0. District admin sees both schools — establishes ground truth for the attacks below.
  const dana = await signInAs("dana.whitfield@riverbend.test");
  const { data: schools, error: schoolsError } = await dana.from("schools").select("id, name");
  if (schoolsError) throw schoolsError;
  const elementary = (schools ?? []).find((s) => s.name.includes("Elementary"));
  const middle = (schools ?? []).find((s) => s.name.includes("Middle"));
  if (!elementary || !middle) {
    throw new Error("Could not resolve both schools as district_admin — did you run `npm run seed`?");
  }

  record(
    "District admin can see both schools",
    (schools?.length ?? 0) >= 2,
    `district_admin SELECT on schools returned ${schools?.length ?? 0} row(s): ${(schools ?? []).map((s) => s.name).join(", ")}`
  );

  const { data: allStudentsAsDana } = await dana.from("students").select("id, school_id");
  const danaElemCount = (allStudentsAsDana ?? []).filter((s) => s.school_id === elementary.id).length;
  const danaMidCount = (allStudentsAsDana ?? []).filter((s) => s.school_id === middle.id).length;
  record(
    "District admin sees students in both schools",
    danaElemCount > 0 && danaMidCount > 0,
    `Saw ${danaElemCount} elementary + ${danaMidCount} middle student row(s).`
  );

  // 1. Teacher baseline: Aisha (Middle school) sees only her own assigned students by default.
  const aisha = await signInAs("aisha.brown@riverbend.test");
  const { data: aishaDefault, error: aishaDefaultError } = await aisha.from("students").select("id, school_id");
  if (aishaDefaultError) throw aishaDefaultError;
  record(
    "Teacher's unfiltered SELECT returns only her own assigned students",
    (aishaDefault ?? []).length > 0 && (aishaDefault ?? []).every((s) => s.school_id === middle.id),
    `Returned ${aishaDefault?.length ?? 0} row(s), all from her school: ${(aishaDefault ?? []).every((s) => s.school_id === middle.id)}`
  );

  // 2. THE ATTACK: Aisha explicitly queries the OTHER school's students by id.
  const { data: aishaAttack, error: aishaAttackError } = await aisha
    .from("students")
    .select("id, school_id")
    .eq("school_id", elementary.id);
  if (aishaAttackError) {
    record(
      "Teacher cannot read another school's students (cross-school attack)",
      true,
      `Query errored outright (also an acceptable block): ${aishaAttackError.message}`
    );
  } else {
    record(
      "Teacher cannot read another school's students (cross-school attack)",
      (aishaAttack ?? []).length === 0,
      `Explicit .eq('school_id', <elementary>) as a Middle-school teacher returned ${aishaAttack?.length ?? 0} row(s) — expected 0.`
    );
  }

  // 3. Aisha can't even read the other school's own metadata row.
  const { data: aishaSchoolAttack } = await aisha.from("schools").select("id").eq("id", elementary.id);
  record(
    "Teacher cannot read another school's own record",
    (aishaSchoolAttack ?? []).length === 0,
    `Returned ${aishaSchoolAttack?.length ?? 0} row(s) — expected 0.`
  );

  // 4. WRITE-SIDE ATTACK: Aisha tries to insert an assessment for a student she's not assigned to.
  const { data: elemStudentAsDana } = await dana.from("students").select("id").eq("school_id", elementary.id).limit(1);
  const foreignStudentId = elemStudentAsDana?.[0]?.id;
  if (foreignStudentId) {
    const { error: insertError } = await aisha.from("assessments").insert({
      student_id: foreignStudentId,
      subject: "math",
      assessment_name: "RLS Attack Probe",
      administered_at: "2026-07-16",
      evidence_source: "rls-test",
    });
    record(
      "Teacher cannot insert an assessment for a student outside her assignments",
      !!insertError,
      insertError ? `Insert correctly rejected: ${insertError.message}` : "Insert unexpectedly SUCCEEDED — this is an RLS gap."
    );
    if (!insertError) {
      // Shouldn't happen, but clean up if the policy has a gap.
      await dana.from("assessments").delete().eq("assessment_name", "RLS Attack Probe");
    }
  } else {
    record("Teacher cannot insert an assessment for a student outside her assignments", false, "Could not find a foreign student to test against — check seed data.");
  }

  // 5. Mirrored attack from the other teacher, other direction.
  const priya = await signInAs("priya.shah@riverbend.test");
  const { data: priyaAttack, error: priyaAttackError } = await priya
    .from("students")
    .select("id, school_id")
    .eq("school_id", middle.id);
  if (priyaAttackError) {
    record(
      "Teacher cannot read the OTHER school's students (mirrored attack)",
      true,
      `Query errored outright (also an acceptable block): ${priyaAttackError.message}`
    );
  } else {
    record(
      "Teacher cannot read the OTHER school's students (mirrored attack)",
      (priyaAttack ?? []).length === 0,
      `Priya's explicit .eq('school_id', <middle>) returned ${priyaAttack?.length ?? 0} row(s) — expected 0.`
    );
  }

  // 6. School leader boundary: Monica (Elementary leader) should never see Middle school students.
  const monica = await signInAs("monica.reyes@riverbend.test");
  const { data: monicaAll } = await monica.from("students").select("id, school_id");
  const monicaSeesOtherSchool = (monicaAll ?? []).some((s) => s.school_id === middle.id);
  record(
    "School leader's unfiltered SELECT never includes the other school",
    (monicaAll ?? []).length > 0 && !monicaSeesOtherSchool,
    `Returned ${monicaAll?.length ?? 0} row(s); any from the other school: ${monicaSeesOtherSchool}`
  );

  // 7. Student: can only ever see their own row.
  const liam = await signInAs("liam.ortiz@riverbend.test");
  const { data: liamAll } = await liam.from("students").select("id");
  record(
    "Student's unfiltered SELECT returns only their own row",
    (liamAll ?? []).length === 1,
    `Returned ${liamAll?.length ?? 0} row(s) — expected exactly 1 (self).`
  );

  console.log("\n== Summary ==");
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nVerification script crashed:", err);
  process.exit(1);
});
