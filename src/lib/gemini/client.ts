import { GoogleGenerativeAI } from "@google/generative-ai";

import { getSettings } from "../settings";

export async function getModel(modelName: "gemini-2.5-flash" | "gemini-2.0-flash" | "gemini-2.0-pro-exp" = "gemini-2.5-flash", userId: string) {
  const settings = await getSettings(userId);
  const apiKey = settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY; // fallback to env for dev if needed
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in settings");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Wrap generateContent with retry logic for 429 rate limits
  const originalGenerateContent = model.generateContent.bind(model);
  model.generateContent = async function (...args: Parameters<typeof originalGenerateContent>) {
    let retries = 3;
    let delay = 2000;
    while (true) {
      try {
        return await originalGenerateContent(...args);
      } catch (err: any) {
        const isRateLimit =
          err?.status === 429 ||
          err?.statusText === "Too Many Requests" ||
          String(err).includes("429") ||
          String(err).includes("Quota exceeded") ||
          String(err).includes("Too Many Requests");

        if (isRateLimit && retries > 0) {
          console.warn(`[Gemini API] Rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries--;
          delay *= 2;
        } else {
          throw err;
        }
      }
    }
  };

  return model;
}
