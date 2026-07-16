import type { District, School, Teacher, Student, Assessment, Intervention } from "@/types/schemas";

/**
 * Data adapter contract. Phase 1 defined the read path only.
 * Phase 2 implements MockOneRosterAdapter / MockEdFiAdapter reading from
 * /mocks/data/*.json — no live SIS/LMS network calls in the MVP. Both
 * adapters read a different wire shape but normalize to the same domain
 * types (types/schemas.ts) so every dashboard is adapter-agnostic.
 */
export interface StudentDataAdapter {
  getDistrict(districtId: string): Promise<District | null>;
  getSchoolsByDistrict(districtId: string): Promise<School[]>;
  getSchoolById(schoolId: string): Promise<School | null>;
  getTeachersBySchool(schoolId: string): Promise<Teacher[]>;
  getStudentsBySchool(schoolId: string): Promise<Student[]>;
  getStudentsByTeacher(teacherId: string): Promise<Student[]>;
  getStudentById(studentId: string): Promise<Student | null>;
  getAssessmentsByStudent(studentId: string): Promise<Assessment[]>;
  getInterventionsByStudent(studentId: string): Promise<Intervention[]>;
}

/** Thrown by adapters when a caller requests data outside their RLS-permitted scope. */
export class UnauthorizedScopeError extends Error {
  constructor(message = "Requested scope exceeds caller's role permissions.") {
    super(message);
    this.name = "UnauthorizedScopeError";
  }
}
