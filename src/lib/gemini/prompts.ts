
import { readPromptFile } from "./prompts-loader";

export interface IdeaGenerationInput {
  weekId: string;
  existingTitles: string[];
  approvedTitles?: string[];
}

export interface GeneratedIdea {
  title: string;
  summary: string;
  angle: string;
}

export function buildIdeaGenerationPrompt(input: IdeaGenerationInput): string {
  const { weekId, existingTitles, approvedTitles = [] } = input;

  const exclusionBlock =
    existingTitles.length > 0
      ? `## Previously generated ideas — DO NOT repeat or closely overlap with any of these\n\n` +
        existingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n") +
        `\n\nBefore finalising each idea, mentally check: "Does this title cover the same concept, technology, or argument as any item above?" If yes, discard it and think of something else.\n\n`
      : `## No previous ideas — this is the first generation run.\n\n`;

  const learningBlock =
    approvedTitles.length > 0
      ? `## The User's Taste\nThe user has explicitly APPROVED the following past ideas. Analyze these to learn their specific tastes, preferred formats, and writing style. Try to generate some ideas in a similar vein:\n\n` +
        approvedTitles.map((t) => `- ${t}`).join("\n") +
        `\n\n`
      : "";

  const template = readPromptFile("idea_generation.txt");
  return template
    .replace("{{exclusionBlock}}", exclusionBlock)
    .replace("{{learningBlock}}", learningBlock)
    .replace("{{weekId}}", weekId);
}

export function parseIdeaResponse(rawText: string): GeneratedIdea[] {
  let text = rawText.trim();

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
