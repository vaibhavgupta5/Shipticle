/**
 * Idea Generation Prompt
 *
 * This file is the single source of truth for the Gemini prompt used to
 * generate weekly article ideas. Review and tune this before running in prod.
 */

import { readPromptFile } from "./prompts-loader";

export interface IdeaGenerationInput {
  weekId: string;
  existingTitles: string[];
}

export interface GeneratedIdea {
  title: string;
  summary: string;
  angle: string;
}

/**
 * Builds the idea generation prompt.
 *
 * PROMPT DESIGN NOTES:
 * - Persona: senior software engineer writing for peer developers.
 * - Target reader: working engineers (not beginners, not managers).
 * - Topics: practical, tooling-heavy, architecture decisions, DX improvements,
 *   emerging-but-proven tech, dev workflow. Avoid pure theory or career advice.
 * - Dedup: all past titles passed as hard exclusions — Gemini instructed to
 *   check for both exact AND semantic overlap before finalising each idea.
 * - Output: strict JSON so the response can be parsed reliably without regex.
 */
export function buildIdeaGenerationPrompt(input: IdeaGenerationInput): string {
  const { weekId, existingTitles } = input;

  const exclusionBlock =
    existingTitles.length > 0
      ? `## Previously generated ideas — DO NOT repeat or closely overlap with any of these\n\n` +
        existingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n") +
        `\n\nBefore finalising each idea, mentally check: "Does this title cover the same concept, technology, or argument as any item above?" If yes, discard it and think of something else.\n\n`
      : `## No previous ideas — this is the first generation run.\n\n`;

  const template = readPromptFile("idea_generation.txt");
  return template
    .replace("{{exclusionBlock}}", exclusionBlock)
    .replace("{{weekId}}", weekId);
}

/**
 * Parses Gemini's raw text response into structured idea objects.
 * Strips markdown fences if Gemini adds them despite the instruction.
 */
export function parseIdeaResponse(rawText: string): GeneratedIdea[] {
  let text = rawText.trim();

  // Strip ```json ... ``` fences if present
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini returned non-array JSON");
  }

  return parsed.map((item: Record<string, unknown>, i: number) => {
    if (
      typeof item.title !== "string" ||
      typeof item.summary !== "string" ||
      typeof item.angle !== "string"
    ) {
      throw new Error(`Idea at index ${i} is missing required fields`);
    }
    return {
      title: item.title,
      summary: item.summary,
      angle: item.angle,
    };
  });
}
