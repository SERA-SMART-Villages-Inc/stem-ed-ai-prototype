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

import orgs from "@/mocks/data/oneroster/orgs.json";
import users from "@/mocks/data/oneroster/users.json";
import classes from "@/mocks/data/oneroster/classes.json";
import enrollments from "@/mocks/data/oneroster/enrollments.json";
import assessmentLineItems from "@/mocks/data/oneroster/assessmentLineItems.json";
import assessmentResults from "@/mocks/data/oneroster/assessmentResults.json";
import interventionsRaw from "@/mocks/data/oneroster/interventions.json";

/**
 * Reads a synthetic OneRoster-shaped export (orgs/users/classes/enrollments +
 * the OneRoster Assessments extension for results) and normalizes it to the
 * shared domain types in types/schemas.ts. Interventions are not part of the
 * OneRoster spec — mocks/data/oneroster/interventions.json is a documented
 * vendor extension, same as real-world SIS integrations commonly ship.
 */

// Synthetic export timestamp — these SIS entities have no native created_at.
const SYNTHETIC_EXPORT_TIMESTAMP = "2025-08-01T00:00:00.000Z";

const ORG_TYPE_TO_GRADE_BAND: Record<string, School["grade_band"]> = {
  "K-5": "K-5",
  "6-8": "6-8",
  "9-12": "9-12",
  "K-8": "K-8",
  "K-12": "K-12",
};

function gradeCodeToLevel(code: string): number {
  if (code === "KG") return 0;
  const n = parseInt(code, 10);
  return Number.isNaN(n) ? 0 : n;
}

type OneRosterUser = (typeof users)[number];
type OneRosterOrg = (typeof orgs)[number];

function findPrimaryTeacherId(studentSourcedId: string): string | null {
  const studentEnrollment = enrollments.find(
    (e) => e.userSourcedId === studentSourcedId && e.role === "student" && e.primary
  );
  if (!studentEnrollment) return null;
  const teacherEnrollment = enrollments.find(
    (e) => e.classSourcedId === studentEnrollment.classSourcedId && e.role === "teacher"
  );
  return teacherEnrollment?.userSourcedId ?? null;
}

function toStudent(user: OneRosterUser): Student {
  const schoolId = user.orgSourcedIds[0] ?? "";
  const meta = (user.metadata ?? {}) as { has_iep?: boolean; has_504?: boolean };
  return {
    id: user.sourcedId,
    school_id: schoolId,
    grade_level: gradeCodeToLevel(user.grades?.[0] ?? "00"),
    synthetic_student_ref: user.identifier,
    primary_teacher_id: findPrimaryTeacherId(user.sourcedId),
    has_iep: meta.has_iep ?? false,
    has_504: meta.has_504 ?? false,
    created_at: SYNTHETIC_EXPORT_TIMESTAMP,
  };
}

function toTeacher(user: OneRosterUser): Teacher {
  const meta = (user.metadata ?? {}) as { subjectsTaught?: AssessmentSubject[] };
  return {
    id: user.sourcedId,
    school_id: user.orgSourcedIds[0] ?? "",
    subjects_taught: meta.subjectsTaught ?? [],
    created_at: SYNTHETIC_EXPORT_TIMESTAMP,
  };
}

function toSchool(org: OneRosterOrg): School {
  const meta = (org.metadata ?? {}) as { gradeBand?: string };
  return {
    id: org.sourcedId,
    district_id: org.parentSourcedId ?? "",
    name: org.name,
    nces_school_id: org.identifier ?? null,
    grade_band: ORG_TYPE_TO_GRADE_BAND[meta.gradeBand ?? "K-5"] ?? "K-5",
    created_at: SYNTHETIC_EXPORT_TIMESTAMP,
    updated_at: SYNTHETIC_EXPORT_TIMESTAMP,
  };
}

export class MockOneRosterAdapter implements StudentDataAdapter {
  async getDistrict(districtId: string): Promise<District | null> {
    const org = orgs.find((o) => o.sourcedId === districtId && o.type === "district");
    if (!org) return null;
    return {
      id: org.sourcedId,
      name: org.name,
      state: "CA",
      nces_district_id: org.identifier ?? null,
      created_at: SYNTHETIC_EXPORT_TIMESTAMP,
      updated_at: SYNTHETIC_EXPORT_TIMESTAMP,
    };
  }

  async getSchoolsByDistrict(districtId: string): Promise<School[]> {
    return orgs
      .filter((o) => o.type === "school" && o.parentSourcedId === districtId)
      .map(toSchool);
  }

  async getSchoolById(schoolId: string): Promise<School | null> {
    const org = orgs.find((o) => o.sourcedId === schoolId && o.type === "school");
    return org ? toSchool(org) : null;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return users
      .filter((u) => u.role === "teacher" && u.orgSourcedIds.includes(schoolId))
      .map(toTeacher);
  }

  async getStudentsBySchool(schoolId: string): Promise<Student[]> {
    return users
      .filter((u) => u.role === "student" && u.orgSourcedIds.includes(schoolId))
      .map(toStudent);
  }

  async getStudentsByTeacher(teacherId: string): Promise<Student[]> {
    const taughtClassIds = new Set(
      enrollments.filter((e) => e.userSourcedId === teacherId && e.role === "teacher").map((e) => e.classSourcedId)
    );
    const studentIds = new Set(
      enrollments
        .filter((e) => e.role === "student" && taughtClassIds.has(e.classSourcedId))
        .map((e) => e.userSourcedId)
    );
    return users.filter((u) => u.role === "student" && studentIds.has(u.sourcedId)).map(toStudent);
  }

  async getStudentById(studentId: string): Promise<Student | null> {
    const user = users.find((u) => u.sourcedId === studentId && u.role === "student");
    return user ? toStudent(user) : null;
  }

  async getAssessmentsByStudent(studentId: string): Promise<Assessment[]> {
    return assessmentResults
      .filter((r) => r.studentSourcedId === studentId)
      .map((r) => {
        const lineItem = assessmentLineItems.find((li) => li.sourcedId === r.assessmentLineItemSourcedId);
        return {
          id: r.sourcedId,
          student_id: r.studentSourcedId,
          subject: (lineItem?.subject ?? "math") as AssessmentSubject,
          assessment_name: lineItem?.title ?? "Unknown Assessment",
          administered_at: r.scoreDate,
          raw_score: r.rawScore,
          scale_score: r.scaleScore,
          percentile: r.scorePercentile,
          proficiency_band: r.proficiencyBand,
          evidence_source: r.metadata.evidenceSource,
          created_at: `${r.scoreDate}T00:00:00.000Z`,
        };
      });
  }

  async getInterventionsByStudent(studentId: string): Promise<Intervention[]> {
    return interventionsRaw
      .filter((iv) => iv.studentSourcedId === studentId)
      .map((iv) => ({
        id: iv.sourcedId,
        student_id: iv.studentSourcedId,
        created_by: iv.createdByUserSourcedId,
        type: iv.type as InterventionType,
        status: iv.status as InterventionStatus,
        subject: (iv.subject as AssessmentSubject | null) ?? null,
        rationale: iv.rationale,
        start_date: iv.startDate,
        end_date: iv.endDate,
        ai_confidence_score: iv.aiConfidenceScore,
        ai_evidence_refs: iv.aiEvidenceRefs,
        created_at: `${iv.startDate ?? "2025-08-01"}T00:00:00.000Z`,
        updated_at: `${iv.startDate ?? "2025-08-01"}T00:00:00.000Z`,
      }));
  }

  async getFullName(profileId: string): Promise<string> {
    return lookupFullName(profileId);
  }
}
