"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { getWeekId } from "@/lib/firebase/firestore";
import { IdeaCard } from "@/components/ideas/idea-card";
import { IdeaHistory } from "@/components/ideas/idea-history";
import type { Idea } from "@/lib/types";

export default function IdeasPage() {
  const weekId = getWeekId();
  const router = useRouter();

  const [thisWeek, setThisWeek] = useState<Idea[]>([]);
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [loading, setLoading] = useState(true);

  // ── Real-time listener for all ideas ──────────────────────────────────
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "ideas"),
        where("userId", "==", user.uid)
      );

      const unsub = onSnapshot(q, (snap) => {
        const ideas = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Idea[];

        // Sort client-side by createdAt descending (newest first)
        ideas.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });

        setAllIdeas(ideas);
        setThisWeek(ideas.filter((i) => i.weekId === weekId));
        setLoading(false);
      });

      return () => unsub();
    });

    return () => unsubAuth();
  }, [weekId]);

  const hasThisWeek = thisWeek.length > 0;
  const hasApproved = thisWeek.some((i) => i.status === "approved");
  const approvedIdea = thisWeek.find((i) => i.status === "approved");
  const historyIdeas = allIdeas.filter((i) => i.weekId !== weekId);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ideas/generate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Generation failed");
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateOutline(ideaId: string) {
    setGeneratingOutline(true);
    setOutlineError(null);
    try {
      const res = await fetch("/api/articles/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate outline");
      router.push(`/dashboard/articles/${body.articleId}`);
    } catch (err) {
      setOutlineError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGeneratingOutline(false);
    }
  }

  const handleApproved = useCallback(() => {
    // onSnapshot updates state automatically after approval
  }, []);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ideas
          </h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Week {weekId} — approve one idea to start the pipeline.
          </p>
        </div>

        {!hasThisWeek && (
          <button
            id="generate-ideas-btn"
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
            onMouseEnter={(e) =>
              !generating && ((e.currentTarget as HTMLElement).style.background = "hsl(var(--accent))")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "hsl(var(--primary))")
            }
          >
            {generating ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Generate this week&apos;s ideas
              </>
            )}
          </button>
        )}
      </div>

      {generateError && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "hsl(var(--destructive) / 0.1)",
            color: "hsl(var(--destructive))",
            border: "1px solid hsl(var(--destructive) / 0.3)",
          }}
        >
          {generateError}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "hsl(var(--muted))" }}
      >
        {(["current", "history"] as const).map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            type="button"
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 capitalize"
            style={
              tab === t
                ? {
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 1px 3px hsl(0 0% 0% / 0.3)",
                  }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            {t === "current" ? `This week` : "History"}
            {t === "history" && historyIdeas.length > 0 && (
              <span
                className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: "hsl(var(--border))",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {historyIdeas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Current week */}
      {tab === "current" && (
        <>
          {/* ── Empty state ─────────────────────────────────────── */}
          {!hasThisWeek && (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderStyle: "dashed",
              }}
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                style={{ background: "hsl(var(--muted))" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" style={{ color: "hsl(var(--muted-foreground))" }} aria-hidden="true">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                  <path d="M9 21h6" /><path d="M10 17v4" /><path d="M14 17v4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                No ideas generated yet for {weekId}
              </p>
              <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Hit &ldquo;Generate this week&apos;s ideas&rdquo; to let Gemini propose 10 article topics.
              </p>
            </div>
          )}

          {/* ── Approved: show banner + generate/view outline ───── */}
          {hasThisWeek && hasApproved && (
            <>
              {outlineError && (
                <div
                  className="mb-3 rounded-lg px-4 py-2.5 text-sm"
                  style={{
                    background: "hsl(var(--destructive) / 0.1)",
                    color: "hsl(var(--destructive))",
                    border: "1px solid hsl(var(--destructive) / 0.3)",
                  }}
                >
                  {outlineError}
                </div>
              )}
              <div
                className="mb-4 rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 flex-wrap"
                style={{
                  background: "hsl(var(--primary) / 0.08)",
                  border: "1px solid hsl(var(--primary) / 0.25)",
                }}
              >
                <span className="flex items-center gap-2" style={{ color: "hsl(var(--primary))" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Idea approved
                </span>

                {approvedIdea?.articleId ? (
                  <a
                    href={`/dashboard/articles/${approvedIdea.articleId}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    View outline →
                  </a>
                ) : (
                  <button
                    id="generate-outline-btn"
                    type="button"
                    onClick={() => approvedIdea && handleGenerateOutline(approvedIdea.id)}
                    disabled={generatingOutline}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    {generatingOutline ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Generating outline…
                      </span>
                    ) : (
                      "Generate outline →"
                    )}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thisWeek.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onApproved={handleApproved}
                    disabled={true}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Pending: show cards with approve buttons ─────────── */}
          {hasThisWeek && !hasApproved && (
            <>
              <p className="text-xs mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                {thisWeek.length} ideas generated. Approve exactly one to proceed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thisWeek.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onApproved={handleApproved}
                    disabled={false}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* History tab */}
      {tab === "history" && (
        <IdeaHistory ideas={allIdeas} />
      )}
    </div>
  );
}
