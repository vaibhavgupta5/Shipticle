"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { getWeekId } from "@/lib/firebase/firestore";
import type { Article, Idea } from "@/lib/types";
import type { User } from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export default function DashboardHomePage() {
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [currentIdeas, setCurrentIdeas] = useState<Idea[]>([]);
  const [pastArticles, setPastArticles] = useState<(Article & { idea?: Idea })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const weekId = getWeekId();

        const user = await new Promise<User | null>((resolve) => {
          const unsub = auth.onAuthStateChanged(u => {
            unsub();
            resolve(u);
          });
          setTimeout(() => {
            unsub();
            resolve(auth.currentUser);
          }, 2000);
        });

        if (!user) {
          setLoading(false);
          return;
        }

        const userId = user.uid;

        const artQ = query(
          collection(db, "articles"),
          where("userId", "==", userId),
          where("weekId", "==", weekId)
        );
        const artSnap = await getDocs(artQ);
        if (!artSnap.empty) {
          const articles = artSnap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
          articles.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() ?? 0;
            const timeB = b.createdAt?.toMillis?.() ?? 0;
            return timeB - timeA;
          });
          setCurrentArticle(articles[0]);
        } else {

          const ideaQ = query(
            collection(db, "ideas"),
            where("userId", "==", userId),
            where("weekId", "==", weekId)
          );
          const ideaSnap = await getDocs(ideaQ);
          let ideas = ideaSnap.docs.map(d => d.data() as Idea);

          if (ideas.length === 0) {
            try {
              const token = await user.getIdToken();
              const res = await fetch("/api/ideas/generate", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                const data = await res.json();
                ideas = data.ideas || [];
              }
            } catch (err) {
              console.error("Lazy idea generation failed", err);
            }
          }
          
          setCurrentIdeas(ideas);
        }

        const pastQ = query(
          collection(db, "articles"),
          where("userId", "==", userId),
          where("status", "==", "published")
        );
        const pastSnap = await getDocs(pastQ);
        const past = pastSnap.docs.map(d => d.data() as Article);

        past.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });
        
        const topPast = past.slice(0, 5);
        const pastWithIdeas = await Promise.all(topPast.map(async a => {
           if (!a.ideaId) return a;
           try {

             const { doc, getDoc } = await import("firebase/firestore");
             const ideaDoc = await getDoc(doc(db, "ideas", a.ideaId));
             if (ideaDoc.exists()) {
               return { ...a, idea: ideaDoc.data() as Idea };
             }
             return a;
           } catch {
             return a;
           }
        }));
        
        setPastArticles(pastWithIdeas);
      } catch (err) {
        console.error("Dashboard load error", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
      </div>
    );
  }

  const weekId = getWeekId();

  let actionTitle = "Generate Ideas";
  let actionDesc = "Start this week's workflow by generating 10 new ideas.";
  let actionUrl = "/dashboard/ideas";
  let buttonText = "Go to Ideas";

  if (currentArticle) {
    actionUrl = `/dashboard/articles/${currentArticle.id}`;
    buttonText = "Resume Work";
    switch (currentArticle.status) {
      case "idea_approved":
        actionTitle = "Idea Approved";
        actionDesc = "Next step: Generate an outline.";
        break;
      case "outline_pending":
      case "outline_approved":
        actionTitle = "Outline Ready";
        actionDesc = "Next step: Generate the draft.";
        break;
      case "draft_generated":
      case "content_approved":
        actionTitle = "Draft Review";
        actionDesc = "Review content, diagrams, and run quality checks.";
        break;
      case "quality_checked":
        actionTitle = "Ready to Publish";
        actionDesc = "Article passed checks. Publish to Dev.to, Hashnode, etc.";
        break;
      case "published":
        actionTitle = "Published!";
        actionDesc = "You successfully published this week's article.";
        buttonText = "View Details";
        break;
      default:
        actionTitle = "Article in Progress";
        actionDesc = "Continue your workflow.";
    }
  } else if (currentIdeas.length > 0) {
    actionTitle = "Ideas Generated";
    actionDesc = "Review and approve one idea to start the article.";
    buttonText = "Review Ideas";
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap pb-4">
          <div>
            <CardTitle className="text-lg mb-1">Current Week: {weekId}</CardTitle>
            <CardDescription className="text-sm">
              Status: <strong className="text-primary">{actionTitle}</strong> — {actionDesc}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href={actionUrl}>{buttonText}</Link>
            </Button>
            {currentArticle?.status === "published" && (
              <Button variant="secondary" asChild>
                <Link href="/dashboard/ideas">Publish one more</Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>

        <div className="mt-8 pt-6 border-t flex items-center justify-between gap-2 overflow-x-auto text-xs font-medium text-muted-foreground">
          {["Ideas", "Outline", "Draft", "Quality", "Publish"].map((step, i) => {
            let active = false;
            let past = false;
            
            if (!currentArticle) {
              if (step === "Ideas") active = true;
            } else {
              const s = currentArticle.status;
              if (step === "Ideas") past = true;
              if (step === "Outline") {
                if (s.includes("outline") || s === "idea_approved") active = true;
                else past = true;
              }
              if (step === "Draft") {
                if (s === "draft_generated" || s === "content_approved") active = true;
                else if (s === "quality_checked" || s === "published") past = true;
              }
              if (step === "Quality") {
                if (s === "quality_checked") active = true;
                else if (s === "published") past = true;
              }
              if (step === "Publish") {
                if (s === "published") active = true;
              }
            }

            return (
              <div key={step} className={`flex items-center gap-2 whitespace-nowrap ${active ? 'text-primary' : past ? 'text-foreground' : ''}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary bg-primary/10' : past ? 'border-foreground bg-foreground/10' : 'border-muted'}`}>
                  {i + 1}
                </div>
                {step}
              </div>
            );
          })}
        </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-bold tracking-tight mb-4">Published Articles</h2>
        {pastArticles.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 border rounded-xl bg-card text-center">No articles published yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastArticles.map(a => (
              <Card key={a.id} className="hover:bg-muted/50 transition-colors flex flex-col h-full group">
                <Link href={`/dashboard/articles/${a.id}`} className="flex flex-col flex-1 p-5">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline">Week {a.weekId}</Badge>
                      <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-transparent">Published</Badge>
                    </div>
                    <h3 className="font-semibold text-lg leading-tight line-clamp-2">{a.idea?.title || "Untitled Article"}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.idea?.summary}</p>
                  </div>
                  <div className="mt-auto flex justify-between items-center pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      {a.createdAt && typeof a.createdAt.toMillis === "function" ? new Date(a.createdAt.toMillis()).toLocaleDateString() : "Just now"}
                    </span>
                    <span className="text-primary text-sm font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
