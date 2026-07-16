import type { StudentDataAdapter } from "@/lib/services/StudentDataAdapter";
import { lookupFullName } from "@/lib/services/profileDirectory";
import type {
  District,
  School,
  Teacher,
  Student,
  Assessment,
  Intervention,
  AssessmentSubject,
  InterventionType,
  InterventionStatus,
} from "@/types/schemas";

import educationOrganizations from "@/mocks/data/edfi/educationOrganizations.json";
import staffs from "@/mocks/data/edfi/staffs.json";
import students from "@/mocks/data/edfi/students.json";
import studentSchoolAssociations from "@/mocks/data/edfi/studentSchoolAssociations.json";
import studentSectionAssociations from "@/mocks/data/edfi/studentSectionAssociations.json";
import studentAssessments from "@/mocks/data/edfi/studentAssessments.json";
import studentInterventionAssociations from "@/mocks/data/edfi/studentInterventionAssociations.json";

/**
 * Reads a synthetic Ed-Fi Data Standard shaped export (educationOrganizations
 * / staffs / students / associations + StudentAssessment) and normalizes it
 * to the shared domain types in types/schemas.ts. AI fields ride in an `_ext`
 * namespace, matching Ed-Fi's real extension convention, since core Ed-Fi
 * has no AI-confidence concept.
 */

const SYNTHETIC_EXPORT_TIMESTAMP = "2025-08-01T00:00:00.000Z";

const GRADE_DESCRIPTOR_TO_LEVEL: Record<string, number> = {
  Kindergarten: 0,
  "First grade": 1,
  "Second grade": 2,
  "Third grade": 3,
  "Fourth grade": 4,
  "Fifth grade": 5,
  "Sixth grade": 6,
  "Seventh grade": 7,
  "Eighth grade": 8,
};

type EdFiEducationOrg = (typeof educationOrganizations)[number];

function inferGradeBand(org: EdFiEducationOrg): School["grade_band"] {
  const grades = org.gradeLevels ?? [];
  const levels = grades.map((g) => GRADE_DESCRIPTOR_TO_LEVEL[g] ?? 0);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  if (min === 0 && max === 5) return "K-5";
  if (min === 6 && max === 8) return "6-8";
  if (min === 9 && max === 12) return "9-12";
  if (min === 0 && max === 8) return "K-8";
  return "K-12";
}

function toSchool(org: EdFiEducationOrg): School {
  return {
    id: org.educationOrganizationId,
    district_id: org.parentEducationOrganizationId ?? "",
    name: org.nameOfInstitution,
    nces_school_id: null,
    grade_band: inferGradeBand(org),
    created_at: SYNTHETIC_EXPORT_TIMESTAMP,
    updated_at: SYNTHETIC_EXPORT_TIMESTAMP,
  };
}

function findPrimaryTeacherId(studentUniqueId: string): string | null {
  const section = studentSectionAssociations.find((s) => s.studentUniqueId === studentUniqueId);
  return section?.staffUniqueId ?? null;
}

function toStudent(student: (typeof students)[number]): Student | null {
  const enrollment = studentSchoolAssociations.find((a) => a.studentUniqueId === student.studentUniqueId);
  if (!enrollment) return null;
  const hasIep = enrollment.studentIndicators.some(
    (i) => i.indicatorName === "IDEA Indicator" && i.indicator === "Yes"
  );
  const has504 = enrollment.studentIndicators.some(
    (i) => i.indicatorName === "Section 504 Indicator" && i.indicator === "Yes"
  );
  return {
    id: student.studentUniqueId,
    school_id: enrollment.schoolId,
    grade_level: GRADE_DESCRIPTOR_TO_LEVEL[enrollment.entryGradeLevelDescriptor] ?? 0,
    synthetic_student_ref: student.studentUniqueId,
    primary_teacher_id: findPrimaryTeacherId(student.studentUniqueId),
    has_iep: hasIep,
    has_504: has504,
    created_at: SYNTHETIC_EXPORT_TIMESTAMP,
  };
}

export class MockEdFiAdapter implements StudentDataAdapter {
  async getDistrict(districtId: string): Promise<District | null> {
    const org = educationOrganizations.find(
      (o) => o.educationOrganizationId === districtId && o.organizationCategory === "LocalEducationAgency"
    );
    if (!org) return null;
    return {
      id: org.educationOrganizationId,
      name: org.nameOfInstitution,
      state: org.stateAbbreviationDescriptor ?? "CA",
      nces_district_id: null,
      created_at: SYNTHETIC_EXPORT_TIMESTAMP,
      updated_at: SYNTHETIC_EXPORT_TIMESTAMP,
    };
  }

  async getSchoolsByDistrict(districtId: string): Promise<School[]> {
    return educationOrganizations
      .filter((o) => o.organizationCategory === "School" && o.parentEducationOrganizationId === districtId)
      .map(toSchool);
  }

  async getSchoolById(schoolId: string): Promise<School | null> {
    const org = educationOrganizations.find(
      (o) => o.educationOrganizationId === schoolId && o.organizationCategory === "School"
    );
    return org ? toSchool(org) : null;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return staffs
      .filter((s) => s.staffClassificationDescriptor === "Teacher" && s.educationOrganizationId === schoolId)
      .map((s) => ({
        id: s.staffUniqueId,
        school_id: s.educationOrganizationId,
        subjects_taught: (s._ext?.subjectsTaught as AssessmentSubject[] | undefined) ?? [],
        created_at: SYNTHETIC_EXPORT_TIMESTAMP,
      }));
  }

  async getStudentsBySchool(schoolId: string): Promise<Student[]> {
    const enrolledIds = new Set(
      studentSchoolAssociations.filter((a) => a.schoolId === schoolId).map((a) => a.studentUniqueId)
    );
    return students
      .filter((s) => enrolledIds.has(s.studentUniqueId))
      .map(toStudent)
      .filter((s): s is Student => s !== null);
  }

  async getStudentsByTeacher(teacherId: string): Promise<Student[]> {
    const studentIds = new Set(
      studentSectionAssociations.filter((s) => s.staffUniqueId === teacherId).map((s) => s.studentUniqueId)
    );
    return students
      .filter((s) => studentIds.has(s.studentUniqueId))
      .map(toStudent)
      .filter((s): s is Student => s !== null);
  }

  async getStudentById(studentId: string): Promise<Student | null> {
    const student = students.find((s) => s.studentUniqueId === studentId);
    return student ? toStudent(student) : null;
  }

  async getAssessmentsByStudent(studentId: string): Promise<Assessment[]> {
    return studentAssessments
      .filter((a) => a.studentUniqueId === studentId)
      .map((a) => ({
        id: a.studentAssessmentIdentifier,
        student_id: a.studentUniqueId,
        subject: a.subject as AssessmentSubject,
        assessment_name: a.assessmentTitle,
        administered_at: a.administrationDate,
        raw_score: a.rawScoreResult,
        scale_score: a.scaleScoreResult,
        percentile: a.percentileScoreResult,
        proficiency_band: a.performanceLevelDescriptor,
        evidence_source: a.dataSourceDescriptor,
        created_at: `${a.administrationDate}T00:00:00.000Z`,
      }));
  }

  async getInterventionsByStudent(studentId: string): Promise<Intervention[]> {
    return studentInterventionAssociations
      .filter((iv) => iv.studentUniqueId === studentId)
      .map((iv) => ({
        id: iv.interventionIdentifier,
        student_id: iv.studentUniqueId,
        created_by: iv.staffUniqueId,
        type: iv.interventionTypeDescriptor as InterventionType,
        status: iv.statusDescriptor as InterventionStatus,
        subject: (iv.subject as AssessmentSubject | null) ?? null,
        rationale: iv.interventionRationale,
        start_date: iv.beginDate,
        end_date: iv.endDate,
        ai_confidence_score: iv._ext?.aiConfidenceScore ?? null,
        ai_evidence_refs: iv._ext?.aiEvidenceRefs ?? null,
        created_at: `${iv.beginDate ?? "2025-08-01"}T00:00:00.000Z`,
        updated_at: `${iv.beginDate ?? "2025-08-01"}T00:00:00.000Z`,
      }));
  }

  async getFullName(profileId: string): Promise<string> {
    return lookupFullName(profileId);
  }
}
