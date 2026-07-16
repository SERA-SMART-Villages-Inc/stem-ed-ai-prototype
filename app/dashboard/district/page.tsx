import { requireRoleSession } from "@/lib/auth/session";
import { resolveAdapter } from "@/lib/services/adapters";
import { StatCard } from "@/components/dashboard/StatCard";
import { redirect } from "next/navigation";

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default async function DistrictDashboardPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const session = await requireRoleSession("district_admin");
  const { profile } = session;
  const districtId = profile.district_id;
  if (!districtId) redirect("/login");

  const adapter = await resolveAdapter(session, searchParams.source);

  const [district, schools] = await Promise.all([
    adapter.getDistrict(districtId),
    adapter.getSchoolsByDistrict(districtId),
  ]);

  const schoolStats = await Promise.all(
    schools.map(async (school) => {
      const students = await adapter.getStudentsBySchool(school.id);
      const [assessments, interventions] = await Promise.all([
        Promise.all(students.map((s) => adapter.getAssessmentsByStudent(s.id))).then((r) => r.flat()),
        Promise.all(students.map((s) => adapter.getInterventionsByStudent(s.id))).then((r) => r.flat()),
      ]);
      const avgPercentile = average(
        assessments.map((a) => a.percentile).filter((p): p is number => p !== null)
      );
      return {
        school,
        studentCount: students.length,
        iepCount: students.filter((s) => s.has_iep).length,
        section504Count: students.filter((s) => s.has_504).length,
        avgPercentile,
        activeInterventions: interventions.filter((i) => i.status === "active").length,
      };
    })
  );

  const totalStudents = schoolStats.reduce((sum, s) => sum + s.studentCount, 0);
  const totalActiveInterventions = schoolStats.reduce((sum, s) => sum + s.activeInterventions, 0);
  const districtAvgPercentile = average(
    schoolStats.map((s) => s.avgPercentile).filter((n): n is number => n !== null)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{district?.name ?? "District"} — Overview</h1>
        <p className="text-sm text-muted-foreground">
          {session.source === "supabase"
            ? "Live Supabase database (RLS-enforced)"
            : `Synthetic mock data · roster source: ${searchParams.source === "edfi" ? "Ed-Fi" : "OneRoster"}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Schools" value={schools.length} />
        <StatCard label="Students" value={totalStudents} />
        <StatCard
          label="Avg. Percentile"
          value={districtAvgPercentile !== null ? Math.round(districtAvgPercentile) : "—"}
        />
        <StatCard label="Active Interventions" value={totalActiveInterventions} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">School</th>
              <th scope="col" className="px-4 py-3">Grade Band</th>
              <th scope="col" className="px-4 py-3">Students</th>
              <th scope="col" className="px-4 py-3">IEP / 504</th>
              <th scope="col" className="px-4 py-3">Avg. Percentile</th>
              <th scope="col" className="px-4 py-3">Active Interventions</th>
            </tr>
          </thead>
          <tbody>
            {schoolStats.map(({ school, studentCount, iepCount, section504Count, avgPercentile, activeInterventions }) => (
              <tr key={school.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{school.name}</td>
                <td className="px-4 py-3">{school.grade_band}</td>
                <td className="px-4 py-3">{studentCount}</td>
                <td className="px-4 py-3">
                  {iepCount} / {section504Count}
                </td>
                <td className="px-4 py-3">{avgPercentile !== null ? Math.round(avgPercentile) : "—"}</td>
                <td className="px-4 py-3">{activeInterventions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
