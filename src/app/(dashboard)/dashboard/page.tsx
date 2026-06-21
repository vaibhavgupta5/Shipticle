"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { getWeekId } from "@/lib/firebase/firestore";
import type { Article, Idea } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardHomePage() {
  const router = useRouter();
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [currentIdeas, setCurrentIdeas] = useState<Idea[]>([]);
  const [pastArticles, setPastArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const weekId = getWeekId();
        
        // Wait for auth to be ready
        const user = await new Promise<any>((resolve) => {
          const unsub = auth.onAuthStateChanged(u => {
            if (u) resolve(u);
            else resolve(null); // Assuming middleware protects, but just in case
          });
          setTimeout(() => resolve(auth.currentUser), 2000);
        });

        if (!user) {
          setLoading(false);
          return;
        }

        const userId = user.uid;
        
        // 1. Current Article
        const artQ = query(
          collection(db, "articles"),
          where("userId", "==", userId),
          where("weekId", "==", weekId),
          limit(1)
        );
        const artSnap = await getDocs(artQ);
        if (!artSnap.empty) {
          setCurrentArticle(artSnap.docs[0].data() as Article);
        } else {
          // If no article, check for ideas
          const ideaQ = query(
            collection(db, "ideas"),
            where("userId", "==", userId),
            where("weekId", "==", weekId)
          );
          const ideaSnap = await getDocs(ideaQ);
          let ideas = ideaSnap.docs.map(d => d.data() as Idea);
          
          // Lazy Generation: If no ideas for the week exist, trigger generation!
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

        // 2. Past published articles
        const pastQ = query(
          collection(db, "articles"),
          where("userId", "==", userId),
          where("status", "==", "published")
        );
        const pastSnap = await getDocs(pastQ);
        const past = pastSnap.docs
          .map(d => d.data() as Article)
          .filter(a => a.weekId !== weekId);
        
        // Sort and limit client-side to avoid composite index requirements
        past.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });
        setPastArticles(past.slice(0, 5));
      } catch (err) {
        console.error("Dashboard load error", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading dashboard...</div>;
  }

  const weekId = getWeekId();

  // Determine current actionable state
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
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>

      <section className="p-6 rounded-2xl border bg-card text-card-foreground">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">Current Week: {weekId}</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Status: <strong className="text-primary">{actionTitle}</strong> — {actionDesc}
            </p>
          </div>
          <Link
            href={actionUrl}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-opacity hover:opacity-90"
          >
            {buttonText}
          </Link>
        </div>

        {/* Visual Progress Bar Approximation */}
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
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Past Publications</h2>
        {pastArticles.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 border rounded-xl bg-card">No past articles found.</p>
        ) : (
          <div className="space-y-3">
            {pastArticles.map(a => (
              <Link key={a.id} href={`/dashboard/articles/${a.id}`} className="block p-4 border rounded-xl hover:bg-card/50 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Week {a.weekId}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Status: Published</p>
                  </div>
                  <span className="text-primary text-sm">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
