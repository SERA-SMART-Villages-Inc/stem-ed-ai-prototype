"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Assessment } from "@/types/schemas";

interface AssessmentTrendChartProps {
  assessments: Assessment[];
}

const SUBJECT_COLORS: Record<string, string> = {
  math: "#0369a1",
  ela: "#7c3aed",
  science: "#059669",
  career_readiness: "#b45309",
};

export function AssessmentTrendChart({ assessments }: AssessmentTrendChartProps) {
  if (assessments.length === 0) {
    return <p className="text-sm text-muted-foreground">No assessment history yet.</p>;
  }

  const subjects = Array.from(new Set(assessments.map((a) => a.subject)));
  const dates = Array.from(new Set(assessments.map((a) => a.administered_at))).sort();

  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const subject of subjects) {
      const match = assessments.find((a) => a.subject === subject && a.administered_at === date);
      row[subject] = match?.percentile ?? null;
    }
    return row;
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend formatter={(value: string) => value.replace(/_/g, " ")} />
          {subjects.map((subject) => (
            <Line
              key={subject}
              type="monotone"
              dataKey={subject}
              stroke={SUBJECT_COLORS[subject] ?? "#0369a1"}
              connectNulls
              strokeWidth={2}
              dot={{ r: 3 }}
              name={subject}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
