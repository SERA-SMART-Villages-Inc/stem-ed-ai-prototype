/**
 * Seeds the live Supabase project with the synthetic Riverbend dataset —
 * the same district/schools/people/assessments/interventions already used
 * by mocks/data/{oneroster,edfi}, so the live dashboards look identical to
 * the mock-backed ones.
 *
 * RUN THIS YOURSELF: `npm run seed`
 *
 * This script creates real Supabase Auth accounts (via the Admin API,
 * using SUPABASE_SERVICE_ROLE_KEY) for all 19 synthetic people, all
 * sharing one throwaway test password. It is meant to be run locally by
 * you, not invoked by an agent — it needs your service-role key and it
 * creates account records, both of which are things you should trigger
 * yourself.
 *
 * Idempotent: safe to re-run. Existing accounts/rows are detected by
 * email or natural key and left alone or upserted; only genuinely new
 * assessment/intervention rows are inserted (there's no DB unique
 * constraint on those two tables, so we de-dupe here instead).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. Aborting.");
  process.exit(1);
}
if (!TEST_PASSWORD) {
  console.error(
    "Missing SEED_TEST_PASSWORD env var. Set your own value (e.g. in .env.local, or inline: " +
      "SEED_TEST_PASSWORD=... npm run seed) before running this script — there is no built-in " +
      "default, since this repo is public."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = "district_admin" | "school_leader" | "teacher" | "student";
type SchoolKey = "elementary" | "middle";

interface PersonSeed {
  key: string;
  email: string;
  full_name: string;
  role: Role;
  school?: SchoolKey;
  subjects?: string[]; // teachers only
  grade_level?: number; // students only
  primary_teacher?: string; // students only — key of a teacher below
  has_iep?: boolean;
  has_504?: boolean;
}

const SCHOOLS: { key: SchoolKey; name: string; nces_school_id: string; grade_band: string }[] = [
  { key: "elementary", name: "Riverbend Elementary School", nces_school_id: "060000101", grade_band: "K-5" },
  { key: "middle", name: "Riverbend Middle School", nces_school_id: "060000102", grade_band: "6-8" },
];

const PEOPLE: PersonSeed[] = [
  { key: "dana_whitfield", email: "dana.whitfield@riverbend.test", full_name: "Dana Whitfield", role: "district_admin" },
  { key: "monica_reyes", email: "monica.reyes@riverbend.test", full_name: "Monica Reyes", role: "school_leader", school: "elementary" },
  { key: "karl_ibsen", email: "karl.ibsen@riverbend.test", full_name: "Karl Ibsen", role: "school_leader", school: "middle" },
  { key: "priya_shah", email: "priya.shah@riverbend.test", full_name: "Priya Shah", role: "teacher", school: "elementary", subjects: ["math", "ela"] },
  { key: "tom_delgado", email: "tom.delgado@riverbend.test", full_name: "Tom Delgado", role: "teacher", school: "elementary", subjects: ["science"] },
  { key: "aisha_brown", email: "aisha.brown@riverbend.test", full_name: "Aisha Brown", role: "teacher", school: "middle", subjects: ["math", "science"] },
  { key: "evan_ng", email: "evan.ng@riverbend.test", full_name: "Evan Ng", role: "teacher", school: "middle", subjects: ["ela", "career_readiness"] },

  { key: "maya_chen", email: "maya.chen@riverbend.test", full_name: "Maya Chen", role: "student", school: "elementary", grade_level: 2, primary_teacher: "priya_shah" },
  { key: "liam_ortiz", email: "liam.ortiz@riverbend.test", full_name: "Liam Ortiz", role: "student", school: "elementary", grade_level: 3, primary_teacher: "priya_shah", has_iep: true },
  { key: "sofia_petrov", email: "sofia.petrov@riverbend.test", full_name: "Sofia Petrov", role: "student", school: "elementary", grade_level: 1, primary_teacher: "tom_delgado" },
  { key: "noah_kim", email: "noah.kim@riverbend.test", full_name: "Noah Kim", role: "student", school: "elementary", grade_level: 4, primary_teacher: "priya_shah" },
  { key: "ava_thompson", email: "ava.thompson@riverbend.test", full_name: "Ava Thompson", role: "student", school: "elementary", grade_level: 5, primary_teacher: "priya_shah", has_504: true },
  { key: "ethan_brooks", email: "ethan.brooks@riverbend.test", full_name: "Ethan Brooks", role: "student", school: "elementary", grade_level: 0, primary_teacher: "tom_delgado" },

  { key: "zoe_martinez", email: "zoe.martinez@riverbend.test", full_name: "Zoe Martinez", role: "student", school: "middle", grade_level: 6, primary_teacher: "aisha_brown" },
  { key: "jaden_wright", email: "jaden.wright@riverbend.test", full_name: "Jaden Wright", role: "student", school: "middle", grade_level: 7, primary_teacher: "aisha_brown", has_iep: true },
  { key: "isabella_nguyen", email: "isabella.nguyen@riverbend.test", full_name: "Isabella Nguyen", role: "student", school: "middle", grade_level: 8, primary_teacher: "evan_ng" },
  { key: "marcus_johnson", email: "marcus.johnson@riverbend.test", full_name: "Marcus Johnson", role: "student", school: "middle", grade_level: 6, primary_teacher: "evan_ng" },
  { key: "chloe_davis", email: "chloe.davis@riverbend.test", full_name: "Chloe Davis", role: "student", school: "middle", grade_level: 7, primary_teacher: "aisha_brown", has_504: true },
  { key: "ryan_patel", email: "ryan.patel@riverbend.test", full_name: "Ryan Patel", role: "student", school: "middle", grade_level: 8, primary_teacher: "evan_ng" },
];

const ASSESSMENTS = [
  { student: "maya_chen", subject: "math", assessment_name: "iReady Diagnostic", administered_at: "2025-09-15", raw_score: 42, scale_score: 421, percentile: 55, proficiency_band: "Basic" },
  { student: "maya_chen", subject: "math", assessment_name: "iReady Diagnostic", administered_at: "2026-01-20", raw_score: 48, scale_score: 438, percentile: 61, proficiency_band: "Proficient" },
  { student: "liam_ortiz", subject: "math", assessment_name: "iReady Diagnostic", administered_at: "2025-09-15", raw_score: 25, scale_score: 388, percentile: 18, proficiency_band: "Below Basic" },
  { student: "liam_ortiz", subject: "math", assessment_name: "iReady Diagnostic", administered_at: "2026-01-20", raw_score: 29, scale_score: 397, percentile: 22, proficiency_band: "Below Basic" },
  { student: "sofia_petrov", subject: "science", assessment_name: "NWEA MAP Growth", administered_at: "2025-09-18", raw_score: 30, scale_score: 175, percentile: 40, proficiency_band: "Basic" },
  { student: "noah_kim", subject: "ela", assessment_name: "STAR Reading", administered_at: "2025-09-18", raw_score: 36, scale_score: 512, percentile: 63, proficiency_band: "Proficient" },
  { student: "ava_thompson", subject: "ela", assessment_name: "STAR Reading", administered_at: "2025-09-18", raw_score: 44, scale_score: 601, percentile: 91, proficiency_band: "Advanced" },
  { student: "ava_thompson", subject: "ela", assessment_name: "STAR Reading", administered_at: "2026-01-22", raw_score: 46, scale_score: 614, percentile: 94, proficiency_band: "Advanced" },
  { student: "ethan_brooks", subject: "science", assessment_name: "NWEA MAP Growth", administered_at: "2025-09-18", raw_score: 18, scale_score: 142, percentile: 35, proficiency_band: "Basic" },
  { student: "zoe_martinez", subject: "math", assessment_name: "STAR Math", administered_at: "2025-09-20", raw_score: 38, scale_score: 655, percentile: 58, proficiency_band: "Proficient" },
  { student: "jaden_wright", subject: "math", assessment_name: "STAR Math", administered_at: "2025-09-20", raw_score: 20, scale_score: 590, percentile: 15, proficiency_band: "Below Basic" },
  { student: "jaden_wright", subject: "math", assessment_name: "STAR Math", administered_at: "2026-01-25", raw_score: 24, scale_score: 602, percentile: 19, proficiency_band: "Below Basic" },
  { student: "isabella_nguyen", subject: "career_readiness", assessment_name: "Career Readiness Screener", administered_at: "2025-09-20", raw_score: 33, scale_score: 700, percentile: 70, proficiency_band: "Proficient" },
  { student: "marcus_johnson", subject: "career_readiness", assessment_name: "Career Readiness Screener", administered_at: "2025-09-20", raw_score: 27, scale_score: 640, percentile: 48, proficiency_band: "Basic" },
  { student: "chloe_davis", subject: "math", assessment_name: "STAR Math", administered_at: "2025-09-20", raw_score: 22, scale_score: 598, percentile: 17, proficiency_band: "Below Basic" },
  { student: "ryan_patel", subject: "career_readiness", assessment_name: "Career Readiness Screener", administered_at: "2025-09-20", raw_score: 35, scale_score: 712, percentile: 75, proficiency_band: "Proficient" },
] as const;

const INTERVENTIONS = [
  {
    student: "liam_ortiz",
    created_by: "priya_shah",
    type: "iep_accommodation",
    status: "active",
    subject: "math",
    rationale:
      "Two consecutive iReady Math diagnostics show percentile in the 18-22 range, below the school's Basic threshold. Recommending extended-time accommodation per current IEP.",
    start_date: "2025-10-01",
    end_date: null,
    ai_confidence_score: 0.82,
    ai_evidence_refs: ["iReady Diagnostic 2025-09-15", "iReady Diagnostic 2026-01-20"],
  },
  {
    student: "sofia_petrov",
    created_by: "tom_delgado",
    type: "tutoring",
    status: "active",
    subject: "science",
    rationale: "Teacher-observed difficulty with lab vocabulary; paired with a peer tutor twice weekly starting this quarter.",
    start_date: "2025-11-03",
    end_date: null,
    ai_confidence_score: null,
    ai_evidence_refs: null,
  },
  {
    student: "ava_thompson",
    created_by: "priya_shah",
    type: "enrichment",
    status: "active",
    subject: "ela",
    rationale:
      "STAR Reading percentile rose from 91 to 94 across two administrations, placing the student in the Advanced band both times. Recommending enrichment novel study group.",
    start_date: "2026-02-01",
    end_date: null,
    ai_confidence_score: 0.76,
    ai_evidence_refs: ["STAR Reading 2025-09-18", "STAR Reading 2026-01-22"],
  },
  {
    student: "zoe_martinez",
    created_by: "aisha_brown",
    type: "small_group",
    status: "proposed",
    subject: "math",
    rationale:
      "STAR Math percentile of 58 sits just above the Basic cutoff; proposing a small-group review block to reinforce fraction operations before the spring benchmark.",
    start_date: null,
    end_date: null,
    ai_confidence_score: null,
    ai_evidence_refs: null,
  },
  {
    student: "chloe_davis",
    created_by: "karl_ibsen",
    type: "504_accommodation",
    status: "active",
    subject: "math",
    rationale: "Existing 504 plan accommodations (extended time, reduced-distraction setting) reaffirmed after STAR Math percentile of 17 this term.",
    start_date: "2025-09-25",
    end_date: null,
    ai_confidence_score: null,
    ai_evidence_refs: null,
  },
  {
    student: "marcus_johnson",
    created_by: "evan_ng",
    type: "behavioral_support",
    status: "completed",
    subject: null,
    rationale:
      "Completed six-week check-in/check-out behavioral support cycle following repeated classroom redirections observed by the teacher in September.",
    start_date: "2025-09-08",
    end_date: "2025-10-17",
    ai_confidence_score: null,
    ai_evidence_refs: null,
  },
] as const;

const STA_SUBJECT_BY_TEACHER: Record<string, string> = {
  priya_shah: "math",
  tom_delgado: "science",
  aisha_brown: "math",
  evan_ng: "ela",
};

async function main() {
  console.log("== Riverbend live-DB seed ==\n");

  // 1. District
  const { data: district, error: districtError } = await supabase
    .from("districts")
    .upsert(
      { name: "Riverbend Unified School District", state: "CA", nces_district_id: "0600001" },
      { onConflict: "nces_district_id" }
    )
    .select()
    .single();
  if (districtError) throw districtError;
  console.log(`District: ${district.name} (${district.id})`);

  // 2. Schools
  const schoolIds: Record<SchoolKey, string> = { elementary: "", middle: "" };
  for (const school of SCHOOLS) {
    const { data, error } = await supabase
      .from("schools")
      .upsert(
        { district_id: district.id, name: school.name, nces_school_id: school.nces_school_id, grade_band: school.grade_band },
        { onConflict: "nces_school_id" }
      )
      .select()
      .single();
    if (error) throw error;
    schoolIds[school.key] = data.id;
    console.log(`School: ${data.name} (${data.id})`);
  }

  // 3. People: create auth users (idempotent — look up existing by email first) + profiles
  console.log("\nAccounts:");
  const { data: existingUsersPage, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existingByEmail = new Map(existingUsersPage.users.map((u) => [u.email, u.id]));

  const personIds: Record<string, string> = {};
  for (const person of PEOPLE) {
    let userId = existingByEmail.get(person.email);

    if (userId) {
      console.log(`  [exists] ${person.full_name.padEnd(20)} ${person.email}`);
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: person.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      if (createError) throw createError;
      userId = created.user.id;
      console.log(`  [created] ${person.full_name.padEnd(20)} ${person.email}`);
    }

    personIds[person.key] = userId;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      role: person.role,
      full_name: person.full_name,
      district_id: district.id,
      school_id: person.school ? schoolIds[person.school] : null,
    });
    if (profileError) throw profileError;
  }

  // 4. Teachers
  for (const person of PEOPLE.filter((p) => p.role === "teacher")) {
    const { error } = await supabase.from("teachers").upsert({
      id: personIds[person.key],
      school_id: schoolIds[person.school as SchoolKey],
      subjects_taught: person.subjects ?? [],
    });
    if (error) throw error;
  }
  console.log("\nTeachers seeded.");

  // 5. Students
  for (const person of PEOPLE.filter((p) => p.role === "student")) {
    const { error } = await supabase.from("students").upsert({
      id: personIds[person.key],
      school_id: schoolIds[person.school as SchoolKey],
      grade_level: person.grade_level as number,
      synthetic_student_ref: `sis-${person.key}`,
      primary_teacher_id: person.primary_teacher ? personIds[person.primary_teacher] : null,
      has_iep: person.has_iep ?? false,
      has_504: person.has_504 ?? false,
    });
    if (error) throw error;
  }
  console.log("Students seeded.");

  // 6. Student-teacher assignments
  for (const person of PEOPLE.filter((p) => p.role === "student")) {
    const teacherKey = person.primary_teacher as string;
    const { error } = await supabase.from("student_teacher_assignments").upsert(
      {
        student_id: personIds[person.key],
        teacher_id: personIds[teacherKey],
        subject: STA_SUBJECT_BY_TEACHER[teacherKey],
        school_year: "2025-2026",
      },
      { onConflict: "student_id,teacher_id,subject,school_year" }
    );
    if (error) throw error;
  }
  console.log("Student-teacher assignments seeded.");

  // 7. Assessments — no unique constraint on this table, so de-dupe by (student, name, date) ourselves.
  const { data: existingAssessments, error: existingAssessmentsError } = await supabase
    .from("assessments")
    .select("student_id, assessment_name, administered_at");
  if (existingAssessmentsError) throw existingAssessmentsError;
  const assessmentKey = (studentId: string, name: string, date: string) => `${studentId}|${name}|${date}`;
  const seenAssessments = new Set((existingAssessments ?? []).map((a) => assessmentKey(a.student_id, a.assessment_name, a.administered_at)));

  let assessmentsInserted = 0;
  for (const a of ASSESSMENTS) {
    const studentId = personIds[a.student];
    if (!studentId) throw new Error(`No seeded person for key "${a.student}" (assessments)`);
    const key = assessmentKey(studentId, a.assessment_name, a.administered_at);
    if (seenAssessments.has(key)) continue;
    const { error } = await supabase.from("assessments").insert({
      student_id: studentId,
      subject: a.subject,
      assessment_name: a.assessment_name,
      administered_at: a.administered_at,
      raw_score: a.raw_score,
      scale_score: a.scale_score,
      percentile: a.percentile,
      proficiency_band: a.proficiency_band,
      evidence_source: "synthetic_mock",
    });
    if (error) throw error;
    assessmentsInserted++;
  }
  console.log(`Assessments seeded (${assessmentsInserted} new, ${ASSESSMENTS.length - assessmentsInserted} already present).`);

  // 8. Interventions — same de-dupe approach, keyed by (student, type).
  const { data: existingInterventions, error: existingInterventionsError } = await supabase
    .from("interventions")
    .select("student_id, type");
  if (existingInterventionsError) throw existingInterventionsError;
  const interventionKey = (studentId: string, type: string) => `${studentId}|${type}`;
  const seenInterventions = new Set((existingInterventions ?? []).map((iv) => interventionKey(iv.student_id, iv.type)));

  let interventionsInserted = 0;
  for (const iv of INTERVENTIONS) {
    const studentId = personIds[iv.student];
    if (!studentId) throw new Error(`No seeded person for key "${iv.student}" (interventions)`);
    const key = interventionKey(studentId, iv.type);
    if (seenInterventions.has(key)) continue;
    const { error } = await supabase.from("interventions").insert({
      student_id: studentId,
      created_by: personIds[iv.created_by],
      type: iv.type,
      status: iv.status,
      subject: iv.subject,
      rationale: iv.rationale,
      start_date: iv.start_date,
      end_date: iv.end_date,
      ai_confidence_score: iv.ai_confidence_score,
      ai_evidence_refs: iv.ai_evidence_refs,
    });
    if (error) throw error;
    interventionsInserted++;
  }
  console.log(`Interventions seeded (${interventionsInserted} new, ${INTERVENTIONS.length - interventionsInserted} already present).`);

  console.log("\n== Done ==");
  console.log("All accounts share the password you set in SEED_TEST_PASSWORD (not printed here).");
  console.log("Test accounts:");
  for (const person of PEOPLE) {
    console.log(`  ${person.role.padEnd(15)} ${person.email}`);
  }
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
