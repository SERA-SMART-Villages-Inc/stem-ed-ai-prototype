import { requireRole } from "@/lib/auth/session";
import { getAdapter, DEFAULT_DATA_SOURCE, type MockDataSource } from "@/lib/services/adapters";
import { ProficiencyBadge, InterventionStatusBadge, FlagBadge } from "@/components/dashboard/badges";
import { StatCard } from "@/components/dashboard/StatCard";
import { lookupFullName } from "@/lib/services/profileDirectory";

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const profile = await requireRole("teacher");
  const source: MockDataSource = searchParams.source === "edfi" ? "edfi" : DEFAULT_DATA_SOURCE;
  const adapter = getAdapter(source);

  const students = await adapter.getStudentsByTeacher(profile.id);

  const rows = await Promise.all(
    students.map(async (student) => {
      const [assessments, interventions] = await Promise.all([
        adapter.getAssessmentsByStudent(student.id),
        adapter.getInterventionsByStudent(student.id),
      ]);
      const latest = [...assessments].sort((a, b) => (a.administered_at < b.administered_at ? 1 : -1))[0] ?? null;
      const activeInterventions = interventions.filter((iv) => iv.status === "active" || iv.status === "proposed");
      return { student, latest, activeInterventions };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">My Students</h1>
        <p className="text-sm text-muted-foreground">
          Synthetic data · roster source: {source === "edfi" ? "Ed-Fi" : "OneRoster"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={students.length} />
        <StatCard
          label="IEP / 504"
          value={`${students.filter((s) => s.has_iep).length} / ${students.filter((s) => s.has_504).length}`}
        />
        <StatCard label="Open Interventions" value={rows.reduce((sum, r) => sum + r.activeInterventions.length, 0)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">Student</th>
              <th scope="col" className="px-4 py-3">Grade</th>
              <th scope="col" className="px-4 py-3">Flags</th>
              <th scope="col" className="px-4 py-3">Latest Assessment</th>
              <th scope="col" className="px-4 py-3">Interventions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, latest, activeInterventions }) => (
              <tr key={student.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium">{lookupFullName(student.id)}</td>
                <td className="px-4 py-3">{student.grade_level === 0 ? "K" : student.grade_level}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {student.has_iep && <FlagBadge label="IEP" />}
                    {student.has_504 && <FlagBadge label="504" />}
                    {!student.has_iep && !student.has_504 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {latest ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {latest.assessment_name} · {latest.administered_at}
                      </p>
                      <ProficiencyBadge band={latest.proficiency_band} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No data</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {activeInterventions.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                    {activeInterventions.map((iv) => (
                      <div key={iv.id} className="flex items-center gap-1.5">
                        <InterventionStatusBadge status={iv.status} />
                        <span className="text-xs capitalize">{iv.type.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
