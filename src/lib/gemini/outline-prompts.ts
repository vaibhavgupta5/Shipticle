/**
 * Outline Generation & Revision Prompts
 *
 * Two prompts live here:
 *  1. buildOutlineGenerationPrompt — first-pass outline from an approved idea.
 *  2. buildOutlineRevisionPrompt   — revision that treats user notes as ground truth.
 *
 * Review both before running in production — especially the revision prompt,
 * since the weighting of user input vs. AI content is the critical design choice.
 */

import type { Idea, OutlineDoc } from "@/lib/types";
import { readPromptFile } from "./prompts-loader";

// ─── Shared output shape ──────────────────────────────────────────────────────

export interface OutlineGenerationOutput {
  outline: OutlineDoc;
  researchLinks: string[];
  researchPrompts: string[];
}

// ─── Prompt 1: Initial outline generation ────────────────────────────────────

/**
 * PROMPT DESIGN NOTES — outline generation:
 *
 * - Asks Gemini for 5–8 structured sections, each with 3–5 bullet points.
 * - Research links: 5–8 real, specific URLs (not example.com placeholders).
 * - Research prompts: 5–8 open questions the author should personally research
 *   before writing — these are meant to surface facts/nuance Gemini can't supply.
 * - Strict JSON output so we can parse without regex.
 * - The "angle" field from the idea is passed in — it should shape the POV of
 *   the outline, not just the title.
 */
export function buildOutlineGenerationPrompt(idea: Idea): string {
  const template = readPromptFile("outline_generation.txt");
  return template
    .replace("{{title}}", idea.title)
    .replace("{{summary}}", idea.summary)
    .replace("{{angle}}", idea.angle);
}

// ─── Prompt 2: Outline revision ───────────────────────────────────────────────

/**
 * PROMPT DESIGN NOTES — revision:
 *
 * The most important design choice here is weighting: user notes must override
 * the AI's previous decisions, not just "inform" them. The prompt achieves this by:
 *
 * 1. Calling user notes "authoritative corrections" and "new ground truth".
 * 2. Explicitly instructing Gemini to change the outline even if it disagrees.
 * 3. Separating user notes from the previous outline visually with clear headers.
 * 4. Telling Gemini to preserve structure where notes don't address — preventing
 *    wholesale rewrites when the user only changed one section.
 *
 * The previous outline is included as a reference base, not as a constraint.
 */
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

// ─── Parser ───────────────────────────────────────────────────────────────────

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
      // Timestamp is set server-side when writing to Firestore; placeholder here
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
