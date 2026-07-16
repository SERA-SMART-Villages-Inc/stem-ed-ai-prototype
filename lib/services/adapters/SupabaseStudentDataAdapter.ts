import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { StudentDataAdapter } from "@/lib/services/StudentDataAdapter";
import type { District, School, Teacher, Student, Assessment, Intervention } from "@/types/schemas";

type Db = SupabaseClient<Database>;

/**
 * Reads directly from the live Postgres tables through a request-scoped
 * Supabase client (the signed-in user's session/JWT) — every query below is
 * a plain `.select()` with no manual scoping. Access control comes entirely
 * from the RLS policies in supabase/migrations/0001_init_schema.sql; if a
 * caller's role/district/school shouldn't see a row, Postgres returns it
 * filtered out (or an empty set), not this class.
 */
export class SupabaseStudentDataAdapter implements StudentDataAdapter {
  constructor(private readonly db: Db) {}

  async getDistrict(districtId: string): Promise<District | null> {
    const { data, error } = await this.db.from("districts").select("*").eq("id", districtId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async getSchoolsByDistrict(districtId: string): Promise<School[]> {
    const { data, error } = await this.db.from("schools").select("*").eq("district_id", districtId);
    if (error) throw error;
    return (data ?? []) as unknown as School[];
  }

  async getSchoolById(schoolId: string): Promise<School | null> {
    const { data, error } = await this.db.from("schools").select("*").eq("id", schoolId).maybeSingle();
    if (error) throw error;
    return data as unknown as School | null;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    const { data, error } = await this.db.from("teachers").select("*").eq("school_id", schoolId);
    if (error) throw error;
    return data ?? [];
  }

  async getStudentsBySchool(schoolId: string): Promise<Student[]> {
    const { data, error } = await this.db.from("students").select("*").eq("school_id", schoolId);
    if (error) throw error;
    return data ?? [];
  }

  async getStudentsByTeacher(teacherId: string): Promise<Student[]> {
    const { data: assignments, error: assignmentsError } = await this.db
      .from("student_teacher_assignments")
      .select("student_id")
      .eq("teacher_id", teacherId);
    if (assignmentsError) throw assignmentsError;

    const studentIds = Array.from(new Set((assignments ?? []).map((a) => a.student_id)));
    if (studentIds.length === 0) return [];

    const { data: students, error: studentsError } = await this.db.from("students").select("*").in("id", studentIds);
    if (studentsError) throw studentsError;
    return students ?? [];
  }

  async getStudentById(studentId: string): Promise<Student | null> {
    const { data, error } = await this.db.from("students").select("*").eq("id", studentId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async getAssessmentsByStudent(studentId: string): Promise<Assessment[]> {
    const { data, error } = await this.db.from("assessments").select("*").eq("student_id", studentId);
    if (error) throw error;
    return data ?? [];
  }

  async getInterventionsByStudent(studentId: string): Promise<Intervention[]> {
    const { data, error } = await this.db.from("interventions").select("*").eq("student_id", studentId);
    if (error) throw error;
    return data ?? [];
  }

  async getFullName(profileId: string): Promise<string> {
    const { data, error } = await this.db.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
    if (error) throw error;
    return data?.full_name ?? profileId;
  }
}
