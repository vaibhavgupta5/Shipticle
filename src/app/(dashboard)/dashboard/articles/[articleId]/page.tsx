"use client";

import { useState, useEffect, isValidElement } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Article, DiagramSpec } from "@/lib/types";
import { use } from "react";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import mermaid from "mermaid";
import { updateDoc } from "firebase/firestore";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, Edit, Check } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

const MermaidPreview = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState<string>('');
  
  useEffect(() => {
    let isMounted = true;
    const id = `mermaid-preview-${Math.random().toString(36).substr(2, 9)}`;
    mermaid.render(id, code)
      .then((res) => {
        if (isMounted) setSvg(res.svg);
      })
      .catch((err) => {
         console.error("Mermaid syntax error", err);
         if (isMounted) setSvg(`<div class="text-destructive text-sm p-4 border border-destructive/20 rounded bg-destructive/10">Invalid Mermaid syntax</div>`);
      });
      return () => { isMounted = false; };
  }, [code]);

  return (
    <div 
      className="flex justify-center py-4 bg-muted/10 rounded-lg my-4 overflow-x-auto border border-border" 
      dangerouslySetInnerHTML={{ __html: svg || '<div class="text-muted-foreground text-sm animate-pulse p-4">Rendering diagram...</div>' }} 
    />
  );
};

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
  const [openCommand, setOpenCommand] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [reviseMode, setReviseMode] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [revising, setRevising] = useState(false);

  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [approvingDraft, setApprovingDraft] = useState(false);
  const [editedContent, setEditedContent] = useState<string | undefined>(undefined);
  const [savingEdits, setSavingEdits] = useState(false);

  const [renderingDiagrams, setRenderingDiagrams] = useState(false);
  const [heroUrlInput, setHeroUrlInput] = useState("");

  const [polishing, setPolishing] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishResults, setPublishResults] = useState<Record<string, { status: string; errorMessage?: string }> | null>(null);

  const isMobile = useIsMobile();

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
      const data = { id: snap.id, ...snap.data() } as Article;
      setArticle(data);
      if (editedContent === undefined && data.content) {
        setEditedContent(data.content);
      }
    });
    return () => unsub();
  }, [articleId, editedContent]);

  async function handleSaveEdits() {
    if (!editedContent || !article) return;
    setSavingEdits(true);
    try {
      const ref = doc(db, "articles", articleId);
      await updateDoc(ref, { content: editedContent });
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdits(false);
    }
  }

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

  async function handlePolish() {
    setPolishing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/polish`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error ?? "Polish failed");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPolishing(false);
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
      <div className="max-w-5xl mx-auto w-full space-y-6">
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
      <div className="max-w-5xl mx-auto w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-6 rounded-lg w-1/2" style={{ background: "hsl(var(--muted))" }} />
          <div className="h-4 rounded w-1/3" style={{ background: "hsl(var(--muted))" }} />
          <div className="h-48 rounded-xl" style={{ background: "hsl(var(--card))" }} />
        </div>
      </div>
    );
  }

  const isLocked = article.status !== "outline_pending" && article.status !== "outline_approved" && article.status !== "draft_generated";

  return (
    <>
      <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { router.push("/dashboard/articles"); setOpenCommand(false); }}>
              Back to Articles
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Actions">
            {!isLocked && article.status === "outline_pending" && (
              <CommandItem onSelect={() => { handleApprove(); setOpenCommand(false); }}>
                Approve Outline
              </CommandItem>
            )}
            {article.status === "outline_approved" && (
              <CommandItem onSelect={() => { handleGenerateDraft(); setOpenCommand(false); }}>
                Generate Full Draft
              </CommandItem>
            )}
            {article.status === "draft_generated" && (
              <CommandItem onSelect={() => { handleApproveDraft(); setOpenCommand(false); }}>
                Approve Content
              </CommandItem>
            )}
            {article.status === "content_approved" && (
              <CommandItem onSelect={() => { handlePolish(); setOpenCommand(false); }}>
                Polish & Optimize
              </CommandItem>
            )}
            {(article.status === "seo_optimized" || article.status === "published") && (
              <CommandItem onSelect={() => { handlePublish(); setOpenCommand(false); }}>
                Publish to Selected
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="h-[calc(100vh-3rem)] flex flex-col gap-4 max-w-[1400px] mx-auto w-full">

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/articles")} className="text-muted-foreground">
              Back
            </Button>
            <h1 className="text-xl font-bold">Week {article.weekId}</h1>
            <Badge variant="outline" className="capitalize">
              {article.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
              <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium">
                <span className="text-[10px]">⌘</span>K
              </kbd>
              Command Palette
            </div>
          </div>
        </div>

        <ResizablePanelGroup direction={isMobile ? "vertical" : "horizontal"} className="flex-1 rounded-xl border border-border shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">

          <ResizablePanel defaultSize={35} minSize={25} className="flex flex-col relative">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-8">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Outline</h2>
                  <div className="space-y-6">
                    {article.outline?.sections.map((section: { heading: string; points: string[] }, i: number) => (
                      <OutlineSection key={i} section={section} index={i} />
                    ))}
                  </div>
                </div>

                {article.researchLinks?.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Research Links</h2>
                    <ul className="space-y-2">
                      {article.researchLinks.map((link: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full shrink-0 bg-primary/50" />
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {article.researchPrompts?.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Research Prompts</h2>
                    <ol className="space-y-3">
                      {article.researchPrompts.map((prompt: string, i: number) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground">
                            {i + 1}
                          </span>
                          <p className="text-xs leading-relaxed">{prompt}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={65} minSize={40} className="flex flex-col relative">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">

                {actionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                  </Alert>
                )}

                {!isLocked && article.status === "outline_pending" && (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <CheckCircle2 className="w-5 h-5" />
                        Outline Review
                      </CardTitle>
                      <CardDescription>
                        Review the outline on the left. If it looks good, approve it to unlock draft generation.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-3">
                      <Button onClick={handleApprove} disabled={approving} className="gap-2">
                        {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Approve Outline
                      </Button>
                      <Button variant="outline" onClick={() => setReviseMode(true)}>
                        Suggest Revisions
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {reviseMode && (
                  <Card className="border-border shadow-sm mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Suggest Revisions</CardTitle>
                      <CardDescription>What should be changed in this outline?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        className="w-full min-h-[100px] p-3 text-sm rounded-lg border bg-background"
                        placeholder="E.g., Add a section about performance..."
                        value={userNotes}
                        onChange={(e) => setUserNotes(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <Button onClick={handleRevise} disabled={revising || !userNotes.trim()}>
                          {revising ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Submit Revisions
                        </Button>
                        <Button variant="ghost" onClick={() => setReviseMode(false)} disabled={revising}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {article.status === "outline_approved" && (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <CheckCircle2 className="w-5 h-5" />
                        Outline Approved
                      </CardTitle>
                      <CardDescription>
                        The outline is locked in. Click below to have the AI write the full first draft.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleGenerateDraft} disabled={generatingDraft} className="w-full sm:w-auto gap-2">
                        {generatingDraft ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Writing draft (takes ~30s)...
                          </>
                        ) : (
                          "Generate Full Article Draft"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {(article.status === "draft_generated" || article.status === "content_approved" || article.status === "quality_checked" || article.status === "seo_optimized" || article.status === "published") && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Edit className="w-4 h-4" />
                        Editor Canvas
                      </h2>
                      {editedContent !== article.content && (
                        <Button size="sm" onClick={handleSaveEdits} disabled={savingEdits}>
                          {savingEdits ? "Saving..." : "Save Edits"}
                        </Button>
                      )}
                    </div>
                    
                    <div data-color-mode="dark" className="rounded-xl overflow-hidden border border-border shadow-sm">
                      <MDEditor
                        value={editedContent ?? article.content ?? ""}
                        onChange={setEditedContent}
                        height={600}
                        previewOptions={{
                          components: {
                            code: ({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              if (!inline && match && match[1] === 'mermaid') {
                                const getCode = (arr: React.ReactNode): string => {
                                  if (typeof arr === 'string') return arr;
                                  if (Array.isArray(arr)) return arr.map(getCode).join('');
                                  if (isValidElement(arr)) {
                                    const props = arr.props as { children?: React.ReactNode };
                                    if (props.children) return getCode(props.children);
                                  }
                                  return '';
                                };
                                const mermaidCode = getCode(children).replace(/\n$/, '');
                                return <MermaidPreview code={mermaidCode} />;
                              }
                              return <code className={className} {...props}>{children}</code>;
                            }
                          }
                        }}
                      />
                    </div>

                    {article.diagramSpecs?.some((s: DiagramSpec) => !s.svgContent) && (
                      <div className="flex justify-end">
                        <Button onClick={handleRenderDiagrams} disabled={renderingDiagrams} variant="secondary">
                          {renderingDiagrams ? "Rendering Diagrams..." : "Render Missing Diagrams"}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {article.status === "draft_generated" && (
                  <div className="flex gap-3">
                    <Button onClick={handleApproveDraft} disabled={approvingDraft || generatingDraft}>
                      {approvingDraft ? "Approving..." : "Approve Content"}
                    </Button>
                    <Button variant="outline" onClick={handleGenerateDraft} disabled={generatingDraft || approvingDraft}>
                      {generatingDraft ? "Regenerating..." : "Regenerate Draft"}
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {article.status === "content_approved" && (
              <div className="shrink-0 border-t bg-background/95 backdrop-blur-md p-4 sm:px-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Content Approved
                  </div>
                  <div className="text-xs text-muted-foreground">The draft is approved. Now, polish the article to check AI detectability, add SEO tags, and prepare for publishing.</div>
                </div>
                <Button onClick={handlePolish} disabled={polishing} className="w-full sm:w-auto bg-gradient-to-br from-primary to-primary/80 shrink-0">
                  {polishing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {polishing ? "Polishing & Optimizing..." : "Polish Draft"}
                </Button>
              </div>
            )}

            {(article.status === "seo_optimized" || article.status === "published") && (
              <div className="shrink-0 border-t bg-background/95 backdrop-blur-md p-4 sm:px-6 flex flex-col gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
                <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between w-full">

                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">AI Detectability</div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold leading-none ${(article.aiDetectionScore ?? 0) > 30 ? 'text-destructive' : 'text-green-500'}`}>
                          {article.aiDetectionScore ?? 0}%
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">likely AI</span>
                      </div>
                    </div>

                    {article.seoTags && article.seoTags.length > 0 && (
                      <div className="hidden sm:block border-l pl-6">
                        <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">SEO Tags</div>
                        <div className="flex flex-wrap gap-1">
                          {article.seoTags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">#{tag}</Badge>
                          ))}
                          {article.seoTags.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{article.seoTags.length - 3}</Badge>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 w-full xl:w-auto border-t xl:border-t-0 pt-4 xl:pt-0">
                    <div className="flex gap-2 flex-1 xl:flex-initial">
                      {[{ id: "devto", label: "Dev.to" }].map(plat => {
                        const isSelected = selectedPlatforms.includes(plat.id);
                        const isDisabled = !isSelected && selectedPlatforms.length >= 2;
                        const res = publishResults?.[plat.id];
                        const hasUrlInDb = article.publishedUrls?.[plat.id] !== undefined;
                        const isSuccess = res?.status === "posted" || hasUrlInDb;
                        
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => togglePlatform(plat.id)}
                            disabled={isDisabled || publishing || isSuccess}
                            className={`flex-1 xl:flex-none px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${isSelected || isSuccess ? 'ring-1 ring-primary border-primary bg-primary/10' : 'border-border'} ${isSuccess ? 'opacity-75 cursor-default' : ''}`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected || isSuccess ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                              {(isSelected || isSuccess) && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span>{plat.label}</span>
                            {isSuccess && <span className="ml-1 text-[10px] uppercase text-green-500 font-bold">Published</span>}
                          </button>
                        );
                      })}
                    </div>
                    <Button onClick={handlePublish} disabled={publishing || selectedPlatforms.length === 0} className="px-6 shrink-0">
                      {publishing ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                </div>

                {(publishResults || (article.publishedUrls && Object.keys(article.publishedUrls).length > 0)) && (
                  <div className="w-full space-y-2">
                    {publishResults && Object.entries(publishResults).map(([platId, res]: [string, { status: string; errorMessage?: string }]) => (
                      res.status === "failed" && (
                        <Alert variant="destructive" key={`fail-${platId}`} className="py-2">
                          <AlertDescription className="text-xs"><strong>{platId} error:</strong> {res.errorMessage}</AlertDescription>
                        </Alert>
                      )
                    ))}
                    {article.publishedUrls && Object.entries(article.publishedUrls).map(([platId, url]) => (
                      <Alert className="border-green-500/20 bg-green-500/10 text-green-500 py-2" key={`success-${platId}`}>
                        <AlertDescription className="text-xs flex items-center">
                          <strong>{platId} published!</strong> 
                          <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-400 font-semibold ml-2 flex items-center gap-1">
                            View Article
                          </a>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
