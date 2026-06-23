"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import type { Article } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, RefreshCcw, FileText, ArrowRight } from "lucide-react";

const STATUS_META: Record<
  string,
  { label: string; variant: string }
> = {
  outline_pending: {
    label: "Outline pending",
    variant: "secondary",
  },
  outline_approved: {
    label: "Outline approved",
    variant: "default",
  },
  draft_generated: {
    label: "Draft ready",
    variant: "default",
  },
  content_approved: {
    label: "Content approved",
    variant: "default",
  },
  quality_checked: {
    label: "Quality checked",
    variant: "default",
  },
  published: {
    label: "Published",
    variant: "default",
  },
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "articles"),
        where("userId", "==", user.uid)
      );

      const unsub = onSnapshot(q, (snap) => {
        const fetched = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Article[];

        fetched.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });

        setArticles(fetched);
        setLoading(false);
      });

      return () => unsub();
    });

    return () => unsubAuth();
  }, []);

  async function handleResetPipeline(e: React.MouseEvent, articleId: string) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to reset this article's pipeline? This will clear all generated content and send it back to Outline Pending.")) return;
    
    try {
      const ref = doc(db, "articles", articleId);
      await updateDoc(ref, {
        status: "outline_pending",
        content: "",
        outline: null,
        outlineHistory: [],
        diagramSpecs: [],
        aiDetectionScore: null,
        plagiarismScore: null,
        plagiarismSources: [],
        seoTags: [],
        heroImageUrl: null
      });
    } catch (err) {
      console.error(err);
      alert("Failed to reset pipeline");
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Articles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All articles across every stage of the pipeline.
        </p>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card border" />
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <Card className="border-dashed shadow-none bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No articles yet
            </p>
            <p className="text-xs text-muted-foreground">
              Approve an idea and generate its outline to create the first article.
            </p>
            <Button asChild variant="link" className="mt-2 text-primary font-medium gap-1.5 p-0 h-auto">
              <Link href="/dashboard/ideas">
                Go to Ideas
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && articles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
          {articles.map((article) => {
            const meta =
              STATUS_META[article.status] ?? {
                label: article.status.replace(/_/g, " "),
                variant: "outline",
              };

            return (
              <Link
                key={article.id}
                href={`/dashboard/articles/${article.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 group"
              >

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Week {article.weekId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {article.outlineHistory?.length ?? 0} revision
                    {(article.outlineHistory?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>

                <Badge variant={meta.variant as React.ComponentProps<typeof Badge>["variant"]} className="shrink-0 font-medium px-2.5 py-0.5">
                  {meta.label}
                </Badge>

                {article.status !== "outline_pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleResetPipeline(e, article.id)}
                    className="shrink-0 text-xs px-2.5 h-7 bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors mr-2 flex items-center gap-1.5 text-muted-foreground"
                    title="Reset Pipeline"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                )}

                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
          </div>
        </Card>
      )}
    </div>
  );
}
