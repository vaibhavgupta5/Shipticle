import fs from "fs";
import path from "path";

export function readPromptFile(filename: string): string {
  const filePath = path.join(process.cwd(), "prompts", filename);
  return fs.readFileSync(filePath, "utf8");
}
