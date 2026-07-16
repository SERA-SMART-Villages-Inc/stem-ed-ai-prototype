import { cn } from "@/lib/utils/cn";
import type { InterventionStatus } from "@/types/schemas";

const PROFICIENCY_STYLES: Record<string, string> = {
  "Below Basic": "bg-red-100 text-red-800",
  Basic: "bg-amber-100 text-amber-800",
  Proficient: "bg-emerald-100 text-emerald-800",
  Advanced: "bg-emerald-200 text-emerald-900",
};

export function ProficiencyBadge({ band }: { band: string | null }) {
  if (!band) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        PROFICIENCY_STYLES[band] ?? "bg-muted text-muted-foreground"
      )}
    >
      {band}
    </span>
  );
}

const STATUS_STYLES: Record<InterventionStatus, string> = {
  proposed: "bg-muted text-muted-foreground",
  active: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  discontinued: "bg-red-100 text-red-800",
};

export function InterventionStatusBadge({ status }: { status: InterventionStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[status])}>
      {status}
    </span>
  );
}

export function FlagBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}
