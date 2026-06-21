import { Timestamp } from "firebase/firestore";

// ─── Shared ────────────────────────────────────────────────────────────────

export type ArticleStatus =
  | "idea_pending"
  | "idea_approved"
  | "idea_rejected"
  | "outline_pending"
  | "outline_approved"
  | "draft_generated"
  | "content_approved"
  | "quality_checked"
  | "published";

export type Platform = "devto" | "hashnode" | "medium";

export type PublicationStatus = "posted" | "failed" | "stored_unpublished";

export type PromptTemplateType =
  | "article_generation"
  | "outline_generation"
  | "outline_revision";

// ─── Outline ───────────────────────────────────────────────────────────────

export interface OutlineSection {
  heading: string;
  points: string[];
}

export interface OutlineDoc {
  sections: OutlineSection[];
  generatedAt: Timestamp;
}

// ─── Diagram ───────────────────────────────────────────────────────────────

export interface DiagramSpec {
  id: string;
  placement: string;
  description: string;
  mermaidCode: string;
  // Rendered SVG stored directly in Firestore (text, ~2-10KB per diagram).
  // No external storage needed — rendered client-side via mermaid.js.
  svgContent: string | null;
}

// ─── Collections ───────────────────────────────────────────────────────────

export interface Idea {
  id: string;
  userId: string;
  weekId: string;
  title: string;
  summary: string;
  angle: string;
  status: "pending" | "approved" | "rejected";
  articleId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Article {
  id: string;
  userId: string;
  ideaId: string;
  weekId: string;
  status: ArticleStatus;

  // Outline stage
  outline: OutlineDoc | null;
  outlineHistory: OutlineDoc[];
  researchLinks: string[];
  researchPrompts: string[];
  userNotes: string;

  // Draft stage
  content: string;
  diagramSpecs: DiagramSpec[];

  // Quality stage
  aiDetectionScore: number | null;
  plagiarismScore: number | null;
  plagiarismSources: string[];

  // Hero
  heroImageUrl: string | null;

  // Meta
  promptTemplateId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Publication {
  id: string;
  userId: string;
  articleId: string;
  platform: Platform;
  status: PublicationStatus;
  platformUrl: string | null;
  errorMessage: string | null;
  attemptedAt: Timestamp;
  succeededAt: Timestamp | null;
}

export interface PromptTemplate {
  id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  type: PromptTemplateType;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
