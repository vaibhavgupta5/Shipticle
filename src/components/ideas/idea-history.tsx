"use client";

import type { Idea } from "@/lib/types";

interface IdeaHistoryProps {
  ideas: Idea[];
}

const statusColor: Record<string, string> = {
  approved: "hsl(var(--primary))",
  rejected: "hsl(var(--muted-foreground))",
  pending: "hsl(199 89% 65%)",
};

export function IdeaHistory({ ideas }: IdeaHistoryProps) {
  // Group by weekId, sorted newest first
  const byWeek = ideas.reduce<Record<string, Idea[]>>(
    (acc, idea) => {
      if (!acc[idea.weekId]) acc[idea.weekId] = [];
      acc[idea.weekId].push(idea);
      return acc;
    },
    {}
  );

  const sortedWeeks = Object.keys(byWeek).sort((a, b) => (a > b ? -1 : 1));


  if (sortedWeeks.length === 0) {
    return (
      <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        No idea history yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {sortedWeeks.map((weekId) => {
        const weekIdeas = byWeek[weekId];
        const approved = weekIdeas.find((i) => i.status === "approved");

        return (
          <section key={weekId}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>
                {weekId}
              </h3>
              {approved && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "hsl(var(--primary) / 0.12)",
                    color: "hsl(var(--primary))",
                  }}
                >
                  ✓ {approved.title}
                </span>
              )}
            </div>

            <div
              className="rounded-xl border divide-y"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                "--divide-color": "hsl(var(--border))",
              } as React.CSSProperties}
            >
              {weekIdeas.map((idea) => (
                <div key={idea.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: statusColor[idea.status] ?? "hsl(var(--muted-foreground))", marginTop: 6 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium leading-snug"
                      style={{
                        color:
                          idea.status === "rejected"
                            ? "hsl(var(--muted-foreground))"
                            : "hsl(var(--foreground))",
                        textDecoration:
                          idea.status === "rejected" ? "line-through" : "none",
                      }}
                    >
                      {idea.title}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {idea.summary}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs capitalize"
                    style={{ color: statusColor[idea.status] ?? "hsl(var(--muted-foreground))" }}
                  >
                    {idea.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
