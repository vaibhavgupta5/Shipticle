import { Timestamp } from "firebase/firestore";

export type ArticleStatus =
  | "idea_pending"
  | "idea_approved"
  | "idea_rejected"
  | "outline_pending"
  | "outline_approved"
  | "draft_generated"
  | "content_approved"
  | "quality_checked"
  | "seo_optimized"
  | "published";

export type Platform = "devto" | "hashnode" | "medium";

export type PublicationStatus = "posted" | "failed" | "stored_unpublished";

export type PromptTemplateType =
  | "article_generation"
  | "outline_generation"
  | "outline_revision";

export interface OutlineSection {
  heading: string;
  points: string[];
}

export interface OutlineDoc {
  sections: OutlineSection[];
  generatedAt: Timestamp;
}

export interface DiagramSpec {
  id: string;
  placement: string;
  description: string;
  mermaidCode: string;

  svgContent: string | null;
}

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

  outline: OutlineDoc | null;
  outlineHistory: OutlineDoc[];
  researchLinks: string[];
  researchPrompts: string[];
  userNotes: string;

  content: string;
  diagramSpecs: DiagramSpec[];

  aiDetectionScore: number | null;
  plagiarismScore: number | null;
  plagiarismSources: string[];

  seoTags?: string[];

  heroImageUrl: string | null;

  promptTemplateId: string | null;
  publishedUrls?: Record<string, string>;
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
  systemPrompt: string; // The base system prompt
  customInstructions?: string; // Optional custom instructions to append
  type: PromptTemplateType;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
