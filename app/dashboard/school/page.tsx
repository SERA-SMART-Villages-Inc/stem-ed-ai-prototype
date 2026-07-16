import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAdapter, DEFAULT_DATA_SOURCE, type MockDataSource } from "@/lib/services/adapters";
import { StatCard } from "@/components/dashboard/StatCard";
import { InterventionStatusBadge } from "@/components/dashboard/badges";
import { lookupFullName } from "@/lib/services/profileDirectory";
import type { InterventionStatus } from "@/types/schemas";

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default async function SchoolDashboardPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const profile = await requireRole("school_leader");
  const schoolId = profile.school_id;
  if (!schoolId) redirect("/login");

  const source: MockDataSource = searchParams.source === "edfi" ? "edfi" : DEFAULT_DATA_SOURCE;
  const adapter = getAdapter(source);

  const [school, teachers, students] = await Promise.all([
    adapter.getSchoolById(schoolId),
    adapter.getTeachersBySchool(schoolId),
    adapter.getStudentsBySchool(schoolId),
  ]);

  const [assessmentsByStudent, interventionsByStudent] = await Promise.all([
    Promise.all(students.map((s) => adapter.getAssessmentsByStudent(s.id))),
    Promise.all(students.map((s) => adapter.getInterventionsByStudent(s.id))),
  ]);
  const allAssessments = assessmentsByStudent.flat();
  const allInterventions = interventionsByStudent.flat();

  const avgPercentile = average(allAssessments.map((a) => a.percentile).filter((p): p is number => p !== null));

  const interventionsByStatus = allInterventions.reduce<Record<InterventionStatus, number>>(
    (acc, iv) => {
      acc[iv.status] += 1;
      return acc;
    },
    { proposed: 0, active: 0, completed: 0, discontinued: 0 }
  );

  const teacherRows = teachers.map((teacher) => ({
    teacher,
    studentCount: students.filter((s) => s.primary_teacher_id === teacher.id).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{school?.name ?? "School"} — Overview</h1>
        <p className="text-sm text-muted-foreground">
          Synthetic data · roster source: {source === "edfi" ? "Ed-Fi" : "OneRoster"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Enrollment" value={students.length} />
        <StatCard
          label="IEP / 504"
          value={`${students.filter((s) => s.has_iep).length} / ${students.filter((s) => s.has_504).length}`}
        />
        <StatCard label="Avg. Percentile" value={avgPercentile !== null ? Math.round(avgPercentile) : "—"} />
        <StatCard label="Active Interventions" value={interventionsByStatus.active} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Teachers</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Teacher</th>
                <th scope="col" className="px-4 py-3">Subjects</th>
                <th scope="col" className="px-4 py-3">Students</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map(({ teacher, studentCount }) => (
                <tr key={teacher.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{lookupFullName(teacher.id)}</td>
                  <td className="px-4 py-3 capitalize">{teacher.subjects_taught.join(", ").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{studentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Interventions by status
        </h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(interventionsByStatus) as InterventionStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <InterventionStatusBadge status={status} />
              <span className="font-medium">{interventionsByStatus[status]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
