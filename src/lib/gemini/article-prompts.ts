/**
 * Article Generation Prompts
 */

import type { OutlineDoc, Idea, DiagramSpec, PromptTemplate } from "@/lib/types";
import { readPromptFile } from "./prompts-loader";

export interface ArticleGenerationOutput {
  markdown: string;
  diagramSpecs: Pick<DiagramSpec, "placement" | "description" | "mermaidCode">[];
}

export const DEFAULT_ARTICLE_SYSTEM_PROMPT = readPromptFile("default_article_system.txt");

/**
 * PROMPT DESIGN NOTES — article generation:
 *
 * This prompt asks Gemini for a JSON object containing both the full markdown string
 * and an array of diagram specifications. This allows us to separate the text content
 * from the Mermaid specs, which we will later render directly using mermaid.js in Phase 5.
 */
export function buildArticleGenerationPrompt(
  idea: Idea,
  outline: OutlineDoc,
  researchLinks: string[],
  userNotes: string,
  systemPrompt: string = DEFAULT_ARTICLE_SYSTEM_PROMPT
): string {
  const outlineText = outline.sections
    .map(
      (s, i) =>
        `${i + 1}. ${s.heading}\n${s.points.map((p) => `   - ${p}`).join("\n")}`
    )
    .join("\n\n");

  const linksText =
    researchLinks.length === 0
      ? "None"
      : researchLinks.map((l) => `- ${l}`).join("\n");

  const template = readPromptFile("article_generation.txt");
  return template
    .replace("{{systemPrompt}}", systemPrompt)
    .replace("{{title}}", idea.title)
    .replace("{{summary}}", idea.summary)
    .replace("{{angle}}", idea.angle)
    .replace("{{outlineText}}", outlineText)
    .replace("{{userNotes}}", userNotes || "None provided.")
    .replace("{{linksText}}", linksText);
}

export function parseArticleResponse(rawText: string): ArticleGenerationOutput {
  let text = rawText.trim();
  if (text.startsWith("\`\`\`")) {
    text = text.replace(/^\`\`\`[a-z]*\n?/, "").replace(/\n?\`\`\`$/, "").trim();
  }

  const parsed = JSON.parse(text) as ArticleGenerationOutput;

  if (!parsed.markdown || typeof parsed.markdown !== "string") {
    throw new Error("Gemini returned invalid or missing markdown field");
  }

  return {
    markdown: parsed.markdown,
    diagramSpecs: Array.isArray(parsed.diagramSpecs) ? parsed.diagramSpecs : [],
  };
}
