"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Article } from "@/lib/types";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";

interface Props {
  params: Promise<{ articleId: string }>;
}

function OutlineSection({
  section,
  index,
}: {
  section: { heading: string; points: string[] };
  index: number;
}) {
  return (
    <div className="group">
      <div className="flex items-start gap-3 mb-2">
        <span
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold mt-0.5"
          style={{
            background: "hsl(var(--primary) / 0.12)",
            color: "hsl(var(--primary))",
          }}
        >
          {index + 1}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
      </div>
      <ul className="ml-9 space-y-1">
        {section.points.map((point, pi) => (
          <li
            key={pi}
            className="text-xs flex items-start gap-2"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "hsl(var(--primary) / 0.5)" }} />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArticlePage({ params }: Props) {
  const { articleId } = use(params);
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [reviseMode, setReviseMode] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [revising, setRevising] = useState(false);
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);

  // Draft generation state
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [approvingDraft, setApprovingDraft] = useState(false);

  // Phase 5 Rendering state
  const [renderingDiagrams, setRenderingDiagrams] = useState(false);
  const [heroUrlInput, setHeroUrlInput] = useState("");
  const [savingHero, setSavingHero] = useState(false);

  // Phase 6 Quality check state
  const [runningQualityCheck, setRunningQualityCheck] = useState(false);

  // Phase 7 Publish state
  const [publishing, setPublishing] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishResults, setPublishResults] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default" });
  }, []);
  useEffect(() => {
    const ref = doc(db, "articles", articleId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      setArticle({ id: snap.id, ...snap.data() } as Article);
    });
    return () => unsub();
  }, [articleId]);

  async function handleApprove() {
    setApproving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approve-outline`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Failed to approve");
      }
      // onSnapshot will update the UI automatically
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setApproving(false);
    }
  }

  async function handleRevise() {
    if (!userNotes.trim()) return;
    setRevising(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/revise-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNotes }),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Revision failed");
      }
      setReviseMode(false);
      setUserNotes("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRevising(false);
    }
  }

  async function handleGenerateDraft() {
    setGeneratingDraft(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/generate-draft`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Draft generation failed");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleApproveDraft() {
    setApprovingDraft(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approve-draft`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Failed to approve draft");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setApprovingDraft(false);
    }
  }

  async function handleRenderDiagrams() {
    if (!article?.diagramSpecs) return;
    setRenderingDiagrams(true);
    setActionError(null);
    try {
      const updates: { id: string; svgContent: string }[] = [];
      for (const spec of article.diagramSpecs) {
        if (!spec.svgContent) {
          const id = "mermaid-render-" + spec.id;
          const { svg } = await mermaid.render(id, spec.mermaidCode);
          updates.push({ id: spec.id, svgContent: svg });
        }
      }

      if (updates.length > 0) {
        const res = await fetch(`/api/articles/${articleId}/diagrams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diagrams: updates }),
        });
        if (!res.ok) {
          const b = await res.json();
          throw new Error(b.error ?? "Failed to save rendered diagrams");
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown rendering error");
    } finally {
      setRenderingDiagrams(false);
    }
  }

  async function handleSaveHero() {
    setSavingHero(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/hero`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImageUrl: heroUrlInput }),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Failed to save hero image");
      }
      setHeroUrlInput(""); // clear input on success, use article.heroImageUrl
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingHero(false);
    }
  }

  async function handleRunQualityCheck() {
    setRunningQualityCheck(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/quality-check`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Failed to run quality checks");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunningQualityCheck(false);
    }
  }

  async function handlePublish() {
    if (selectedPlatforms.length === 0) return;
    setPublishing(true);
    setActionError(null);
    setPublishResults(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPlatforms }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to publish");
      }
      setPublishResults(data.results);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown publish error");
    } finally {
      setPublishing(false);
    }
  }

  function togglePlatform(platId: string) {
    setSelectedPlatforms(prev => {
      if (prev.includes(platId)) return prev.filter(p => p !== platId);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, platId];
    });
  }

  if (notFound) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Article not found.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/articles")}
          className="mt-3 text-sm"
          style={{ color: "hsl(var(--primary))" }}
        >
          ← Back to articles
        </button>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 rounded-lg w-1/2" style={{ background: "hsl(var(--muted))" }} />
          <div className="h-4 rounded w-1/3" style={{ background: "hsl(var(--muted))" }} />
          <div className="h-48 rounded-xl" style={{ background: "hsl(var(--card))" }} />
        </div>
      </div>
    );
  }

  const isLocked = article.status !== "outline_pending" && article.status !== "outline_approved" && article.status !== "draft_generated";
  const revisionCount = article.outlineHistory?.length ?? 0;

  return (
    <div className="max-w-3xl">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push("/dashboard/articles")}
        className="flex items-center gap-1.5 text-xs mb-6 transition-colors"
        style={{ color: "hsl(var(--muted-foreground))" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        All articles
      </button>

      {/* Header */}
      <div className="mb-2 flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background:
                  article.status === "outline_approved"
                    ? "hsl(var(--primary) / 0.12)"
                    : "hsl(var(--muted))",
                color:
                  article.status === "outline_approved"
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground))",
              }}
            >
              {article.status.replace(/_/g, " ")}
            </span>
            {revisionCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((h) => !h)}
                className="text-xs transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {revisionCount} revision{revisionCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Outline Review
          </h1>
          <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            Week {article.weekId}
          </p>
        </div>
      </div>

      {/* Outline */}
      <section
        className="rounded-2xl border p-6 mb-5"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-5"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          Outline
        </h2>
        <div className="space-y-6">
          {article.outline?.sections.map((section, i) => (
            <OutlineSection key={i} section={section} index={i} />
          ))}
        </div>
      </section>

      {/* Research Links */}
      {article.researchLinks?.length > 0 && (
        <section
          className="rounded-2xl border p-6 mb-5"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Research Links
          </h2>
          <ul className="space-y-2">
            {article.researchLinks.map((link, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1 w-1 h-1 rounded-full shrink-0"
                  style={{ background: "hsl(var(--primary) / 0.5)" }}
                />
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs break-all transition-colors"
                  style={{ color: "hsl(var(--primary))" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.textDecoration = "none")
                  }
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Research Prompts */}
      {article.researchPrompts?.length > 0 && (
        <section
          className="rounded-2xl border p-6 mb-6"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Research Prompts
          </h2>
          <ol className="space-y-3">
            {article.researchPrompts.map((prompt, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                  {prompt}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Outline version history (expandable) */}
      {showHistory && revisionCount > 0 && (
        <section
          className="rounded-2xl border p-6 mb-6"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Outline History
          </h2>
          <div className="space-y-6">
            {[...(article.outlineHistory ?? [])].reverse().map((old, i) => (
              <details key={i} className="group">
                <summary
                  className="cursor-pointer text-xs font-medium list-none flex items-center gap-2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 transition-transform group-open:rotate-90" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  Version {revisionCount - i}
                  {(old as { userNotesThatTriggeredRevision?: string }).userNotesThatTriggeredRevision && (
                    <span className="opacity-60 font-normal">— triggered by your notes</span>
                  )}
                </summary>
                <div className="mt-3 pl-5 space-y-3">
                  {(old as { userNotesThatTriggeredRevision?: string }).userNotesThatTriggeredRevision && (
                    <p
                      className="text-xs italic border-l-2 pl-3 py-1"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        borderColor: "hsl(var(--primary) / 0.4)",
                      }}
                    >
                      &ldquo;{(old as { userNotesThatTriggeredRevision?: string }).userNotesThatTriggeredRevision}&rdquo;
                    </p>
                  )}
                  {old.sections.map((s, si) => (
                    <OutlineSection key={si} section={s} index={si} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {actionError && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "hsl(var(--destructive) / 0.1)",
            color: "hsl(var(--destructive))",
            border: "1px solid hsl(var(--destructive) / 0.3)",
          }}
        >
          {actionError}
        </div>
      )}

      {/* Actions (Outline Stage) */}
      {article.status === "outline_pending" && (
        <div className="space-y-3">
          {!reviseMode ? (
            <div className="flex gap-3 flex-wrap">
              {/* Approve */}
              <button
                id="approve-outline-btn"
                type="button"
                onClick={handleApprove}
                disabled={approving || revising}
                className="flex-1 min-w-[140px] rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
                onMouseEnter={(e) =>
                  !approving &&
                  ((e.currentTarget as HTMLElement).style.background = "hsl(var(--accent))")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "hsl(var(--primary))")
                }
              >
                {approving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Approving…
                  </span>
                ) : (
                  "Approve outline"
                )}
              </button>

              {/* Open revise panel */}
              <button
                id="revise-outline-btn"
                type="button"
                onClick={() => setReviseMode(true)}
                disabled={approving || revising}
                className="flex-1 min-w-[140px] rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--secondary-foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                Revise with my notes
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl border p-5"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--primary) / 0.3)",
              }}
            >
              <label
                htmlFor="user-notes-textarea"
                className="block text-xs font-semibold mb-2"
                style={{ color: "hsl(var(--foreground))" }}
              >
                Your research notes &amp; corrections
              </label>
              <p className="text-xs mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                Share findings, corrections, or direction changes. Gemini will treat these as ground truth — they override the previous outline where they conflict.
              </p>
              <textarea
                id="user-notes-textarea"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={6}
                placeholder="e.g. Section 3 is wrong — I tested this in prod and the latency difference is only ~5ms, not 50ms. Also add a section on connection pooling, that's the real bottleneck."
                className="w-full rounded-xl px-4 py-3 text-sm resize-y outline-none transition-all"
                style={{
                  background: "hsl(var(--muted))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                  minHeight: 120,
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--ring))")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))")
                }
              />
              <div className="flex gap-2 mt-3">
                <button
                  id="submit-revision-btn"
                  type="button"
                  onClick={handleRevise}
                  disabled={revising || !userNotes.trim()}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {revising ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Regenerating outline…
                    </span>
                  ) : (
                    "Submit & regenerate outline"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setReviseMode(false); setUserNotes(""); setActionError(null); }}
                  disabled={revising}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
                  style={{
                    background: "hsl(var(--secondary))",
                    color: "hsl(var(--secondary-foreground))",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions (Outline Approved -> Generate Draft) */}
      {article.status === "outline_approved" && (
        <div className="space-y-4">
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
            style={{
              background: "hsl(var(--primary) / 0.08)",
              color: "hsl(var(--primary))",
              border: "1px solid hsl(var(--primary) / 0.25)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Outline approved — ready for draft generation.
          </div>
          
          <button
            type="button"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="w-full sm:w-auto min-w-[200px] rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {generatingDraft ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Writing draft (takes ~30s)…
              </span>
            ) : (
              "Generate Full Article Draft"
            )}
          </button>
        </div>
      )}

      {/* Draft Review UI */}
      {(article.status === "draft_generated" || article.status === "content_approved" || article.status === "quality_checked" || article.status === "published") && (
        <div className="mt-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Draft Review</h2>
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
          </div>

          <article
            className="prose prose-sm dark:prose-invert max-w-none rounded-2xl border p-8"
            style={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <ReactMarkdown>{article.content || "*No content generated yet.*"}</ReactMarkdown>
          </article>

          {/* Diagram Specs / Rendering */}
          {article.diagramSpecs?.length > 0 && (
            <section
              className="rounded-2xl border p-6"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Diagram Specifications
                </h2>
                
                {article.diagramSpecs.some((s) => !s.svgContent) && (
                  <button
                    type="button"
                    onClick={handleRenderDiagrams}
                    disabled={renderingDiagrams}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    {renderingDiagrams ? "Rendering…" : "Render Missing Diagrams"}
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {article.diagramSpecs.map((spec, i) => (
                  <div key={spec.id || i} className="border rounded-xl p-4" style={{ borderColor: "hsl(var(--border))" }}>
                    <div className="flex flex-col gap-2 mb-3">
                      <span className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>Placement:</span>
                      <span className="text-sm">{spec.placement}</span>
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                      <span className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>Description:</span>
                      <span className="text-sm">{spec.description}</span>
                    </div>
                    
                    {spec.svgContent ? (
                      <div className="bg-white p-4 rounded-lg overflow-x-auto flex justify-center">
                        <div dangerouslySetInnerHTML={{ __html: spec.svgContent }} />
                      </div>
                    ) : (
                      <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg overflow-x-auto">
                        <pre className="text-xs m-0"><code>{spec.mermaidCode}</code></pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Hero Image Section */}
          <section
            className="rounded-2xl border p-6"
            style={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Hero Image
            </h2>
            
            {article.heroImageUrl ? (
              <div className="space-y-4">
                <img src={article.heroImageUrl} alt="Hero" className="w-full max-h-[300px] object-cover rounded-xl" />
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={heroUrlInput}
                    onChange={(e) => setHeroUrlInput(e.target.value)}
                    placeholder="Provide a new URL to change..."
                    className="flex-1 rounded-xl px-4 py-2 text-sm border bg-transparent"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                  <button
                    onClick={handleSaveHero}
                    disabled={savingHero || !heroUrlInput}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    {savingHero ? "Saving..." : "Change"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">No hero image set yet.</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={heroUrlInput}
                    onChange={(e) => setHeroUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 rounded-xl px-4 py-2 text-sm border bg-transparent"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                  <button
                    onClick={handleSaveHero}
                    disabled={savingHero || !heroUrlInput}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    {savingHero ? "Saving..." : "Save Image"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Draft Actions */}
          {article.status === "draft_generated" && (
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApproveDraft}
                disabled={approvingDraft || generatingDraft}
                className="flex-1 min-w-[140px] rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                {approvingDraft ? "Approving…" : "Approve Content"}
              </button>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={generatingDraft || approvingDraft}
                className="flex-1 min-w-[140px] rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--secondary-foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {generatingDraft ? "Regenerating…" : "Regenerate Draft"}
              </button>
            </div>
          )}

          {article.status === "content_approved" && (
            <div className="space-y-4">
              <div
                className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
                style={{
                  background: "hsl(var(--primary) / 0.08)",
                  color: "hsl(var(--primary))",
                  border: "1px solid hsl(var(--primary) / 0.25)",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Content approved. Ready for Quality Checks.
              </div>
              
              <button
                type="button"
                onClick={handleRunQualityCheck}
                disabled={runningQualityCheck}
                className="w-full sm:w-auto min-w-[200px] rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                {runningQualityCheck ? "Running Checks..." : "Run Plagiarism & AI Detection"}
              </button>
            </div>
          )}

          {/* Quality Check Results */}
          {(article.status === "quality_checked" || article.status === "published") && (
            <section
              className="rounded-2xl border p-6"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Quality Check Results
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border rounded-xl p-4 flex flex-col gap-1" style={{ borderColor: "hsl(var(--border))" }}>
                  <span className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>AI Detection Score</span>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold" style={{ color: (article.aiDetectionScore ?? 0) > 30 ? "hsl(var(--destructive))" : "hsl(142 70% 45%)" }}>
                      {article.aiDetectionScore}%
                    </span>
                    <span className="text-sm font-medium mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>likely AI</span>
                  </div>
                  {(article.aiDetectionScore ?? 0) > 30 && (
                    <span className="text-xs mt-2" style={{ color: "hsl(var(--destructive))" }}>Warning: High AI likelihood detected.</span>
                  )}
                </div>
                
                <div className="border rounded-xl p-4 flex flex-col gap-1" style={{ borderColor: "hsl(var(--border))" }}>
                  <span className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Plagiarism Score</span>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold" style={{ color: (article.plagiarismScore ?? 0) > 10 ? "hsl(var(--destructive))" : "hsl(142 70% 45%)" }}>
                      {article.plagiarismScore}%
                    </span>
                    <span className="text-sm font-medium mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>match</span>
                  </div>
                  {article.plagiarismSources?.length > 0 && (
                    <div className="text-xs mt-2 space-y-1">
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Sources:</span>
                      <ul className="list-disc list-inside">
                        {article.plagiarismSources.map((s, i) => (
                          <li key={i}><a href={s} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{s}</a></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {article.status === "quality_checked" && (
                <div className="mt-6">
                  <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 mb-4 bg-primary/10 text-primary border border-primary/25">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    Ready for Publishing.
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Publishing UI */}
          {(article.status === "quality_checked" || article.status === "published") && (
            <section
              className="rounded-2xl border p-6"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Publishing
              </h2>
              
              <div className="mb-4">
                <p className="text-sm mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Select up to 2 platforms to publish to right now:</p>
                <div className="flex flex-col gap-3">
                  {[
                    { id: "devto", label: "Dev.to" },
                    { id: "hashnode", label: "Hashnode" },
                    { id: "medium", label: "Medium", warning: "Best-effort / unofficial API — may occasionally fail due to upstream changes" },
                  ].map(plat => {
                    const isSelected = selectedPlatforms.includes(plat.id);
                    const isDisabled = !isSelected && selectedPlatforms.length >= 2;
                    const res = publishResults?.[plat.id];
                    const isSuccess = res?.status === "posted";
                    const isFail = res?.status === "failed";
                    
                    return (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => togglePlatform(plat.id)}
                        disabled={isDisabled || publishing}
                        className={`relative px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left flex flex-col gap-1 ${isSelected ? 'ring-2' : ''}`}
                        style={{
                          background: isSelected ? "hsl(var(--primary) / 0.1)" : "transparent",
                          borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
                          opacity: isDisabled ? 0.5 : 1,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3" className="w-3 h-3"><path d="M20 6 9 17l-5-5" /></svg>}
                          </div>
                          <span className="font-semibold">{plat.label}</span>
                          {plat.warning && (
                            <span className="ml-2 text-xs py-0.5 px-2 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20 font-normal">
                              {plat.warning}
                            </span>
                          )}
                        </div>
                        {isSuccess && <span className="text-xs text-green-500 mt-1">Success!</span>}
                        {isFail && <span className="text-xs text-red-500 mt-1">Failed to publish</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {publishResults && (
                <div className="mb-4 space-y-2">
                  {Object.entries(publishResults).map(([platId, res]) => (
                    res.status === "failed" && (
                      <div key={platId} className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 break-words">
                        <strong>{platId} error:</strong> {res.errorMessage}
                      </div>
                    )
                  ))}
                  {Object.entries(publishResults).map(([platId, res]) => (
                    res.status === "posted" && (
                      <div key={platId} className="p-3 text-xs rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 break-words">
                        <strong>{platId} published!</strong> <a href={res.platformUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-500">View Article</a>
                      </div>
                    )
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || selectedPlatforms.length === 0}
                className="w-full sm:w-auto min-w-[140px] rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                {publishing ? "Publishing..." : "Publish to Selected"}
              </button>
            </section>
          )}
        </div>
      )}

      {/* Locked state */}
      {isLocked && article.status !== "content_approved" && article.status !== "quality_checked" && article.status !== "published" && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 mt-4"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            color: "hsl(var(--primary))",
            border: "1px solid hsl(var(--primary) / 0.25)",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Outline approved — draft generation unlocked in Phase 4.
        </div>
      )}
    </div>
  );
}
