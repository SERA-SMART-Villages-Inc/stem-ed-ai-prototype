import { Sparkles } from "lucide-react";
import type { Intervention } from "@/types/schemas";

interface InterventionProvenanceProps {
  intervention: Pick<Intervention, "ai_confidence_score" | "ai_evidence_refs">;
}

/**
 * AI-safety disclosure for a single intervention. Whenever an intervention
 * carries an ai_confidence_score, its confidence and cited evidence must
 * render here, inline, every time the intervention is shown to staff —
 * never let a caller render just the type/status badge for one of these,
 * since that presents an AI suggestion as if a human authored it.
 * Human-originated interventions (ai_confidence_score is null) render
 * nothing. Intentionally not used on the student dashboard — see
 * app/dashboard/student/page.tsx for that audience-appropriate omission.
 */
export function InterventionProvenance({ intervention }: InterventionProvenanceProps) {
  if (intervention.ai_confidence_score === null) return null;

  const confidencePct = Math.round(intervention.ai_confidence_score * 100);
  const evidence = intervention.ai_evidence_refs ?? [];

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
      <div className="flex items-center gap-1.5 font-medium">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        AI-suggested · {confidencePct}% confidence
      </div>
      {evidence.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {evidence.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
