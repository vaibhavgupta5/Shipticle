import { NextResponse, NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { requireAuth } from "@/lib/auth/require-auth";
import { readPromptFile } from "@/lib/gemini/prompts-loader";

export async function GET(request: NextRequest) {
  let token;
  try {
    token = await requireAuth(request);
  } catch (err) {
    return err as Response;
  }

  try {

    const settings = await getSettings(token.uid);

    return NextResponse.json({
      GEMINI_API_KEY: !!settings.GEMINI_API_KEY,
      DEVTO_API_KEY: !!settings.DEVTO_API_KEY,
      HASHNODE_API_TOKEN: !!settings.HASHNODE_API_TOKEN,
      HASHNODE_PUBLICATION_ID: !!settings.HASHNODE_PUBLICATION_ID,
      RAPIDAPI_KEY: !!settings.RAPIDAPI_KEY,
      MEDIUM_USER_ID: !!settings.MEDIUM_USER_ID,
      X_PROFILE: settings.X_PROFILE || "",
      LINKEDIN_PROFILE: settings.LINKEDIN_PROFILE || "",
      GITHUB_PROFILE: settings.GITHUB_PROFILE || "",
      SHORT_BIO: settings.SHORT_BIO || "",
      PORTFOLIO_URL: settings.PORTFOLIO_URL || "",
      defaultSystemPrompt: readPromptFile("default_article_system.txt"),
    });
  } catch (error) {
    console.error("[GET /api/settings]", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let token;
  try {
    token = await requireAuth(request);
  } catch (err) {
    return err as Response;
  }

  try {
    const body = await request.json();

    const allowedKeys = [
      "GEMINI_API_KEY",
      "DEVTO_API_KEY",
      "HASHNODE_API_TOKEN",
      "HASHNODE_PUBLICATION_ID",
      "RAPIDAPI_KEY",
      "MEDIUM_USER_ID",
      "X_PROFILE",
      "LINKEDIN_PROFILE",
      "GITHUB_PROFILE",
      "SHORT_BIO",
      "PORTFOLIO_URL",
    ];
    
    const updates: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    await saveSettings(token.uid, updates);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/settings]", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
