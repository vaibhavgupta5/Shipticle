
import type { OutlineDoc, Idea, DiagramSpec, PromptTemplate } from "@/lib/types";
import { readPromptFile } from "./prompts-loader";

export interface ArticleGenerationOutput {
  markdown: string;
  diagramSpecs: Pick<DiagramSpec, "placement" | "description" | "mermaidCode">[];
}

export const DEFAULT_ARTICLE_SYSTEM_PROMPT = readPromptFile("default_article_system.txt");

export interface SeoOptimizationOutput {
  content: string;
  seoTags: string[];
}

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

export function buildSeoOptimizationPrompt(
  draft: string,
  aiScore: number,
  authorProfile: {
    bio: string;
    x: string;
    linkedin: string;
    github: string;
    portfolio: string;
  }
): string {
  const template = readPromptFile("seo_prompt.txt");
  
  const profileText = `
Short Bio: ${authorProfile.bio || "None"}
X (Twitter): ${authorProfile.x || "None"}
LinkedIn: ${authorProfile.linkedin || "None"}
GitHub: ${authorProfile.github || "None"}
Portfolio URL: ${authorProfile.portfolio || "None"}
  `.trim();

  return `
${template}

---
Here are the inputs for your task:

AI_DETECTION_SCORE: ${aiScore}%

AUTHOR_PROFILE:
${profileText}

ARTICLE_DRAFT:
${draft}
  `.trim();
}

export function parseSeoResponse(rawText: string): SeoOptimizationOutput {
  let text = rawText.trim();
  if (text.startsWith("\`\`\`")) {
    text = text.replace(/^\`\`\`[a-z]*\n?/, "").replace(/\n?\`\`\`$/, "").trim();
  }

  const parsed = JSON.parse(text) as SeoOptimizationOutput;

  if (!parsed.content || typeof parsed.content !== "string") {
    throw new Error("Gemini returned invalid or missing content field");
  }

  return {
    content: parsed.content,
    seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [],
  };
}
