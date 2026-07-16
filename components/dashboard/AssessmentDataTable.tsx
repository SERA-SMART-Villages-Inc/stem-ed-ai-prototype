import type { Assessment } from "@/types/schemas";

interface AssessmentDataTableProps {
  assessments: Assessment[];
}

/**
 * Text-based equivalent of AssessmentTrendChart (WCAG 2.2 SC 1.1.1 — a
 * chart is non-text content and needs a text alternative conveying the
 * same information). Always rendered alongside the chart, visible by
 * default — not behind a toggle or hidden in a collapsed section.
 */
export function AssessmentDataTable({ assessments }: AssessmentDataTableProps) {
  if (assessments.length === 0) {
    return <p className="text-sm text-muted-foreground">No assessment history yet.</p>;
  }

  const sorted = [...assessments].sort((a, b) => (a.administered_at < b.administered_at ? -1 : 1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted-foreground">
          Assessment percentile by subject and date — the same data shown in the chart above, as a table.
        </caption>
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">Date</th>
            <th scope="col" className="px-3 py-2">Subject</th>
            <th scope="col" className="px-3 py-2">Assessment</th>
            <th scope="col" className="px-3 py-2">Percentile</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-3 py-2">{a.administered_at}</td>
              <td className="px-3 py-2 capitalize">{a.subject.replace(/_/g, " ")}</td>
              <td className="px-3 py-2">{a.assessment_name}</td>
              <td className="px-3 py-2">{a.percentile !== null ? `${a.percentile}th` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
