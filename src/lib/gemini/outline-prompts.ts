
import type { Idea, OutlineDoc } from "@/lib/types";
import { readPromptFile } from "./prompts-loader";

export interface OutlineGenerationOutput {
  outline: OutlineDoc;
  researchLinks: string[];
  researchPrompts: string[];
}

export function buildOutlineGenerationPrompt(idea: Idea): string {
  const template = readPromptFile("outline_generation.txt");
  return template
    .replace("{{title}}", idea.title)
    .replace("{{summary}}", idea.summary)
    .replace("{{angle}}", idea.angle);
}

export function buildOutlineRevisionPrompt(
  currentOutline: OutlineDoc,
  userNotes: string,
  idea: Idea
): string {
  const outlineText = currentOutline.sections
    .map(
      (s, i) =>
        `${i + 1}. ${s.heading}\n${s.points.map((p) => `   - ${p}`).join("\n")}`
    )
    .join("\n\n");

  const template = readPromptFile("outline_revision.txt");
  return template
    .replace("{{title}}", idea.title)
    .replace("{{summary}}", idea.summary)
    .replace("{{outlineText}}", outlineText)
    .replace("{{userNotes}}", userNotes);
}

export function parseOutlineResponse(
  rawText: string
): OutlineGenerationOutput {
  let text = rawText.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(text) as {
    sections: { heading: string; points: string[] }[];
    researchLinks: string[];
    researchPrompts: string[];
  };

  if (!Array.isArray(parsed.sections)) {
    throw new Error("Gemini returned outline without sections array");
  }

  return {
    outline: {
      sections: parsed.sections.map((s) => ({
        heading: String(s.heading),
        points: Array.isArray(s.points) ? s.points.map(String) : [],
      })),

      generatedAt: new Date() as unknown as import("firebase/firestore").Timestamp,
    },
    researchLinks: Array.isArray(parsed.researchLinks)
      ? parsed.researchLinks.map(String)
      : [],
    researchPrompts: Array.isArray(parsed.researchPrompts)
      ? parsed.researchPrompts.map(String)
      : [],
  };
}
