/**
 * Hand-authored placeholder matching supabase/migrations/0001_init_schema.sql.
 * Replace with `supabase gen types typescript` output once a live project
 * ref exists — keep shape in sync until then.
 */

export type AppRole = "district_admin" | "school_leader" | "teacher" | "student";
export type AssessmentSubject = "math" | "ela" | "science" | "career_readiness";
export type InterventionStatus = "proposed" | "active" | "completed" | "discontinued";
export type InterventionType =
  | "tutoring"
  | "small_group"
  | "iep_accommodation"
  | "504_accommodation"
  | "behavioral_support"
  | "enrichment"
  | "counseling_referral";

export interface Database {
  public: {
    Tables: {
      districts: {
        Row: {
          id: string;
          name: string;
          state: string;
          nces_district_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["districts"]["Row"]> & {
          name: string;
          state: string;
        };
        Update: Partial<Database["public"]["Tables"]["districts"]["Row"]>;
      };
      schools: {
        Row: {
          id: string;
          district_id: string;
          name: string;
          nces_school_id: string | null;
          grade_band: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["schools"]["Row"]> & {
          district_id: string;
          name: string;
          grade_band: string;
        };
        Update: Partial<Database["public"]["Tables"]["schools"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          role: AppRole;
          full_name: string;
          district_id: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          role: AppRole;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      teachers: {
        Row: {
          id: string;
          school_id: string;
          subjects_taught: AssessmentSubject[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["teachers"]["Row"]> & {
          id: string;
          school_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["teachers"]["Row"]>;
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          grade_level: number;
          synthetic_student_ref: string;
          primary_teacher_id: string | null;
          has_iep: boolean;
          has_504: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["students"]["Row"]> & {
          id: string;
          school_id: string;
          grade_level: number;
          synthetic_student_ref: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Row"]>;
      };
      student_teacher_assignments: {
        Row: {
          id: string;
          student_id: string;
          teacher_id: string;
          subject: AssessmentSubject;
          school_year: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_teacher_assignments"]["Row"]> & {
          student_id: string;
          teacher_id: string;
          subject: AssessmentSubject;
          school_year: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_teacher_assignments"]["Row"]>;
      };
      assessments: {
        Row: {
          id: string;
          student_id: string;
          subject: AssessmentSubject;
          assessment_name: string;
          administered_at: string;
          raw_score: number | null;
          scale_score: number | null;
          percentile: number | null;
          proficiency_band: string | null;
          evidence_source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assessments"]["Row"]> & {
          student_id: string;
          subject: AssessmentSubject;
          assessment_name: string;
          administered_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessments"]["Row"]>;
      };
      interventions: {
        Row: {
          id: string;
          student_id: string;
          created_by: string;
          type: InterventionType;
          status: InterventionStatus;
          subject: AssessmentSubject | null;
          rationale: string;
          start_date: string | null;
          end_date: string | null;
          ai_confidence_score: number | null;
          ai_evidence_refs: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interventions"]["Row"]> & {
          student_id: string;
          created_by: string;
          type: InterventionType;
          rationale: string;
        };
        Update: Partial<Database["public"]["Tables"]["interventions"]["Row"]>;
      };
    };
  };
}
