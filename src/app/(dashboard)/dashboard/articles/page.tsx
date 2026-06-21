"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import type { Article } from "@/lib/types";

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  outline_pending: {
    label: "Outline pending",
    color: "hsl(40 90% 60%)",
    bg: "hsl(40 90% 60% / 0.12)",
  },
  outline_approved: {
    label: "Outline approved",
    color: "hsl(var(--primary))",
    bg: "hsl(var(--primary) / 0.12)",
  },
  draft_generated: {
    label: "Draft ready",
    color: "hsl(199 89% 55%)",
    bg: "hsl(199 89% 55% / 0.12)",
  },
  content_approved: {
    label: "Content approved",
    color: "hsl(var(--primary))",
    bg: "hsl(var(--primary) / 0.12)",
  },
  quality_checked: {
    label: "Quality checked",
    color: "hsl(142 70% 50%)",
    bg: "hsl(142 70% 50% / 0.12)",
  },
  published: {
    label: "Published",
    color: "hsl(142 70% 45%)",
    bg: "hsl(142 70% 45% / 0.12)",
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

        // Sort client-side by createdAt descending (newest first)
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

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Articles
        </h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          All articles across every stage of the pipeline.
        </p>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl"
              style={{ background: "hsl(var(--card))" }}
            />
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
            borderStyle: "dashed",
          }}
        >
          <p className="text-sm font-medium text-foreground mb-1">
            No articles yet
          </p>
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Approve an idea and generate its outline to create the first article.
          </p>
          <Link
            href="/dashboard/ideas"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "hsl(var(--primary))" }}
          >
            Go to Ideas
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          {articles.map((article) => {
            const meta =
              STATUS_META[article.status] ?? {
                label: article.status.replace(/_/g, " "),
                color: "hsl(var(--muted-foreground))",
                bg: "hsl(var(--muted))",
              };

            return (
              <Link
                key={article.id}
                href={`/dashboard/articles/${article.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors group"
                style={{ borderColor: "hsl(var(--border))" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "hsl(var(--muted) / 0.5)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "")
                }
              >
                {/* Status dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Week {article.weekId}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {article.outlineHistory?.length ?? 0} revision
                    {(article.outlineHistory?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </span>

                {/* Arrow */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
