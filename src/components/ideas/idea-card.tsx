"use client";

import { useState } from "react";
import type { Idea } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";

interface IdeaCardProps {
  idea: Idea;
  onApproved: (ideaId: string) => void;
  disabled?: boolean;
}

const statusStyles: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; label: string; cardClass: string }
> = {
  pending: {
    variant: "secondary",
    label: "Pending",
    cardClass: "border-border",
  },
  approved: {
    variant: "default",
    label: "Approved",
    cardClass: "border-primary bg-primary/5",
  },
  rejected: {
    variant: "outline",
    label: "Rejected",
    cardClass: "opacity-50",
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
    <Card className={`group flex flex-col transition-all duration-300 hover:shadow-md ${style.cardClass} ${!isApproved ? 'hover:border-primary/40' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-bold leading-tight flex-1 text-foreground/90 group-hover:text-primary transition-colors duration-300">
            {idea.title}
          </CardTitle>
          <Badge variant={style.variant} className="shrink-0 shadow-sm">
            {style.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pb-3 text-sm text-muted-foreground flex flex-col gap-4">
        <p className="leading-relaxed">
          {idea.summary}
        </p>
        
        {idea.angle && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 relative overflow-hidden group-hover:bg-primary/10 transition-colors duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
            <p className="italic text-foreground/80 flex gap-2">
              <span className="text-primary/60 font-serif text-lg leading-none">&ldquo;</span>
              <span className="pt-0.5">{idea.angle}</span>
            </p>
          </div>
        )}
      </CardContent>

      {(idea.status === "pending" || idea.status === "rejected") && (
        <CardFooter className="pt-2 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-destructive w-full text-center bg-destructive/10 p-2 rounded">
              {error}
            </p>
          )}
          <Button
            id={`approve-${idea.id}`}
            type="button"
            onClick={handleApprove}
            disabled={loading || disabled}
            variant={idea.status === "rejected" ? "outline" : "default"}
            className={`w-full group/btn transition-all duration-300 ${idea.status === 'rejected' ? 'border-primary/30 text-primary hover:bg-primary/10' : 'shadow-sm hover:shadow'}`}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving…
              </>
            ) : idea.status === "rejected" ? (
              "Revive & Approve"
            ) : (
              "Approve Idea"
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
