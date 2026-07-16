import { requireRoleSession } from "@/lib/auth/session";
import { resolveAdapter } from "@/lib/services/adapters";
import { AssessmentTrendChart } from "@/components/dashboard/AssessmentTrendChart";
import { InterventionStatusBadge } from "@/components/dashboard/badges";
import type { InterventionType } from "@/types/schemas";

const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  tutoring: "Tutoring",
  small_group: "Small Group Support",
  iep_accommodation: "IEP Accommodation",
  "504_accommodation": "504 Accommodation",
  behavioral_support: "Behavioral Support",
  enrichment: "Enrichment",
  counseling_referral: "Counseling Referral",
};

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const session = await requireRoleSession("student");
  const { profile } = session;
  const adapter = await resolveAdapter(session, searchParams.source);

  const [assessments, interventions] = await Promise.all([
    adapter.getAssessmentsByStudent(profile.id),
    adapter.getInterventionsByStudent(profile.id),
  ]);

  const sortedAssessments = [...assessments].sort((a, b) => (a.administered_at < b.administered_at ? -1 : 1));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Hi, {profile.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s how your assessments and supports are tracking.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assessment history</h2>
        <div className="rounded-lg border border-border p-4">
          <AssessmentTrendChart assessments={assessments} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Support &amp; interventions
        </h2>
        {interventions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active supports right now.</p>
        ) : (
          <ul className="space-y-3">
            {interventions.map((iv) => (
              <li key={iv.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{INTERVENTION_TYPE_LABELS[iv.type]}</p>
                  <InterventionStatusBadge status={iv.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{iv.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent scores</h2>
        <ul className="space-y-2">
          {sortedAssessments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
            >
              <span>
                {a.assessment_name} · {a.administered_at}
              </span>
              <span className="font-medium">
                {a.percentile !== null ? `${a.percentile}th percentile` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
