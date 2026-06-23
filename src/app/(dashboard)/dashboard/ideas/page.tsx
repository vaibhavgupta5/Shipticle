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

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2, History, Lightbulb } from "lucide-react";

export default function IdeasPage() {
  const weekId = getWeekId();
  const router = useRouter();

  const [thisWeek, setThisWeek] = useState<Idea[]>([]);
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  }, []);

  return (
    <div className="max-w-5xl mx-auto w-full">

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ideas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Week {weekId} — approve one idea to start the pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {historyIdeas.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="h-4 w-4" />
                  Idea History
                  <Badge variant="secondary" className="ml-1 px-1.5">{historyIdeas.length}</Badge>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle>Idea History</SheetTitle>
                  <SheetDescription>
                    Review ideas generated in previous weeks.
                  </SheetDescription>
                </SheetHeader>
                <IdeaHistory ideas={allIdeas} />
              </SheetContent>
            </Sheet>
          )}

          {!hasThisWeek && (
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate this week's ideas"
              )}
            </Button>
          )}
        </div>
      </div>

      {generateError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{generateError}</AlertDescription>
        </Alert>
      )}

        <>

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
                <Lightbulb className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                No ideas generated yet for {weekId}
              </p>
              <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Hit &ldquo;Generate this week&apos;s ideas&rdquo; to let Gemini propose 10 article topics.
              </p>
            </div>
          )}

          {hasThisWeek && (
            <>
              {outlineError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription>{outlineError}</AlertDescription>
                </Alert>
              )}

              {thisWeek.filter(i => i.status === "approved").map((approved) => (
                <div
                  key={`banner-${approved.id}`}
                  className="mb-4 rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 flex-wrap border border-primary/20 bg-primary/10"
                >
                  <span className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Idea approved: <span className="font-bold opacity-80 ml-1 truncate max-w-[200px] sm:max-w-[300px]">{approved.title}</span>
                  </span>

                  {approved.articleId ? (
                    <Button asChild size="sm" variant="default">
                      <a href={`/dashboard/articles/${approved.articleId}`}>
                        View workflow →
                      </a>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleGenerateOutline(approved.id)}
                      disabled={generatingOutline}
                      size="sm"
                    >
                      {generatingOutline ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating outline…
                        </>
                      ) : (
                        "Generate outline →"
                      )}
                    </Button>
                  )}
                </div>
              ))}

              <p className="text-xs mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                {thisWeek.length} ideas generated. You can approve multiple ideas to work on them simultaneously.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thisWeek.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onApproved={handleApproved}
                    disabled={idea.status === "approved"}
                  />
                ))}
              </div>
            </>
          )}
        </>
    </div>
  );
}
