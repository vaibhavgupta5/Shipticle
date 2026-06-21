"use client";

import { useState } from "react";
import type { Idea } from "@/lib/types";

interface IdeaCardProps {
  idea: Idea;
  onApproved: (ideaId: string) => void;
  disabled?: boolean;
}

const statusStyles: Record<
  string,
  { bg: string; border: string; badge: string; label: string }
> = {
  pending: {
    bg: "hsl(var(--card))",
    border: "hsl(var(--border))",
    badge: "hsl(var(--muted))",
    label: "Pending",
  },
  approved: {
    bg: "hsl(199 89% 55% / 0.06)",
    border: "hsl(199 89% 55% / 0.4)",
    badge: "hsl(199 89% 55% / 0.15)",
    label: "Approved",
  },
  rejected: {
    bg: "hsl(var(--card))",
    border: "hsl(var(--border))",
    badge: "hsl(var(--muted))",
    label: "Rejected",
  },
};

export function IdeaCard({ idea, onApproved, disabled }: IdeaCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = statusStyles[idea.status] ?? statusStyles.pending;
  const isRejected = idea.status === "rejected";
  const isApproved = idea.status === "approved";

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to approve");
      }
      onApproved(idea.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className="rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: style.bg,
        borderColor: style.border,
        opacity: isRejected ? 0.5 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-sm font-semibold leading-snug flex-1"
          style={{ color: isRejected ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}
        >
          {idea.title}
        </h3>
        <span
          className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: style.badge,
            color: isApproved
              ? "hsl(var(--primary))"
              : "hsl(var(--muted-foreground))",
          }}
        >
          {style.label}
        </span>
      </div>

      {/* Summary */}
      <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
        {idea.summary}
      </p>

      {/* Angle */}
      {idea.angle && (
        <p
          className="text-xs italic border-l-2 pl-3"
          style={{
            color: "hsl(var(--muted-foreground))",
            borderColor: "hsl(var(--primary) / 0.4)",
          }}
        >
          {idea.angle}
        </p>
      )}

      {/* Action */}
      {idea.status === "pending" && (
        <div className="mt-auto pt-1">
          {error && (
            <p className="text-xs mb-2" style={{ color: "hsl(var(--destructive))" }}>
              {error}
            </p>
          )}
          <button
            id={`approve-${idea.id}`}
            type="button"
            onClick={handleApprove}
            disabled={loading || disabled}
            className="w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "hsl(var(--primary) / 0.12)",
              color: "hsl(var(--primary))",
              border: "1px solid hsl(var(--primary) / 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!loading && !disabled) {
                (e.currentTarget as HTMLElement).style.background = "hsl(var(--primary) / 0.22)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(var(--primary) / 0.12)";
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Approving…
              </span>
            ) : (
              "Approve this idea"
            )}
          </button>
        </div>
      )}
    </article>
  );
}
