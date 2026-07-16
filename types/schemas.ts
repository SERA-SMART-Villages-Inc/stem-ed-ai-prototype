import { z } from "zod";

/* ----------------------------------------------------------------------- */
/* Enums — mirror Postgres enum types in 0001_init_schema.sql              */
/* ----------------------------------------------------------------------- */

export const appRoleSchema = z.enum([
  "district_admin",
  "school_leader",
  "teacher",
  "student",
]);

export const assessmentSubjectSchema = z.enum([
  "math",
  "ela",
  "science",
  "career_readiness",
]);

export const interventionStatusSchema = z.enum([
  "proposed",
  "active",
  "completed",
  "discontinued",
]);

export const interventionTypeSchema = z.enum([
  "tutoring",
  "small_group",
  "iep_accommodation",
  "504_accommodation",
  "behavioral_support",
  "enrichment",
  "counseling_referral",
]);

/* ----------------------------------------------------------------------- */
/* Districts / Schools                                                     */
/* ----------------------------------------------------------------------- */

export const districtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  state: z.string().length(2),
  nces_district_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const schoolSchema = z.object({
  id: z.string().uuid(),
  district_id: z.string().uuid(),
  name: z.string().min(1),
  nces_school_id: z.string().nullable(),
  grade_band: z.enum(["K-5", "6-8", "9-12", "K-8", "K-12"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/* ----------------------------------------------------------------------- */
/* Profiles / Teachers / Students                                          */
/* ----------------------------------------------------------------------- */

export const profileSchema = z.object({
  id: z.string().uuid(),
  role: appRoleSchema,
  full_name: z.string().min(1),
  district_id: z.string().uuid().nullable(),
  school_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).superRefine(scopeMustMatchRole);

function scopeMustMatchRole(
  data: { role: z.infer<typeof appRoleSchema>; district_id: string | null; school_id: string | null },
  ctx: z.RefinementCtx
) {
  if (data.role === "district_admin" && !data.district_id) {
    ctx.addIssue({ code: "custom", message: "district_admin requires district_id" });
  }
  if (["school_leader", "teacher", "student"].includes(data.role) && !data.school_id) {
    ctx.addIssue({ code: "custom", message: `${data.role} requires school_id` });
  }
}

export const teacherSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  subjects_taught: z.array(assessmentSubjectSchema).default([]),
  created_at: z.string().datetime(),
});

export const studentSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  grade_level: z.number().int().min(0).max(12),
  synthetic_student_ref: z.string().min(1),
  primary_teacher_id: z.string().uuid().nullable(),
  has_iep: z.boolean().default(false),
  has_504: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const studentTeacherAssignmentSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  subject: assessmentSubjectSchema,
  school_year: z.string().regex(/^\d{4}-\d{4}$/, "expected format YYYY-YYYY"),
  created_at: z.string().datetime(),
});

/* ----------------------------------------------------------------------- */
/* Assessments                                                             */
/* ----------------------------------------------------------------------- */

export const assessmentSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  subject: assessmentSubjectSchema,
  assessment_name: z.string().min(1),
  administered_at: z.string().date(),
  raw_score: z.number().nullable(),
  scale_score: z.number().nullable(),
  percentile: z.number().min(0).max(100).nullable(),
  proficiency_band: z.string().nullable(),
  evidence_source: z.string().min(1), // required provenance for AI citation
  created_at: z.string().datetime(),
});

/* ----------------------------------------------------------------------- */
/* Interventions — AI-safety constraints enforced here AND in Postgres     */
/* ----------------------------------------------------------------------- */

export const interventionSchema = z
  .object({
    id: z.string().uuid(),
    student_id: z.string().uuid(),
    created_by: z.string().uuid(),
    type: interventionTypeSchema,
    status: interventionStatusSchema.default("proposed"),
    subject: assessmentSubjectSchema.nullable(),
    rationale: z.string().min(10, "Rationale must cite observable evidence, not a diagnosis."),
    start_date: z.string().date().nullable(),
    end_date: z.string().date().nullable(),
    ai_confidence_score: z.number().min(0).max(1).nullable(),
    ai_evidence_refs: z.array(z.string()).nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((data, ctx) => {
    // AI Safety Constraint: any AI-attributed suggestion MUST carry both a
    // confidence score and at least one cited evidence reference. Mirrors
    // the `ai_requires_evidence` CHECK constraint in the SQL migration.
    if (data.ai_confidence_score !== null) {
      if (!data.ai_evidence_refs || data.ai_evidence_refs.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "AI-suggested interventions must include ai_evidence_refs.",
          path: ["ai_evidence_refs"],
        });
      }
    }
    // Guard against disability-diagnosis language leaking into rationale text.
    // This is a defense-in-depth lint, not a substitute for prompt-level
    // guardrails in the AI service layer.
    const diagnosticTerms = /\b(diagnos(e|is|ed)|has autism|has adhd|is dyslexic)\b/i;
    if (diagnosticTerms.test(data.rationale)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Rationale must not assert a diagnosis. Describe observed evidence and refer to a qualified professional for evaluation.",
        path: ["rationale"],
      });
    }
  });

/* ----------------------------------------------------------------------- */
/* Inferred domain types (single source of truth: schema -> type)          */
/* ----------------------------------------------------------------------- */

export type AppRole = z.infer<typeof appRoleSchema>;
export type AssessmentSubject = z.infer<typeof assessmentSubjectSchema>;
export type InterventionStatus = z.infer<typeof interventionStatusSchema>;
export type InterventionType = z.infer<typeof interventionTypeSchema>;

export type District = z.infer<typeof districtSchema>;
export type School = z.infer<typeof schoolSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Teacher = z.infer<typeof teacherSchema>;
export type Student = z.infer<typeof studentSchema>;
export type StudentTeacherAssignment = z.infer<typeof studentTeacherAssignmentSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Intervention = z.infer<typeof interventionSchema>;
