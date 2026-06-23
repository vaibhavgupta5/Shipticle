import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getModel } from "@/lib/gemini/client";
import { buildSeoOptimizationPrompt, parseSeoResponse } from "@/lib/gemini/article-prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import { getSettings } from "@/lib/settings";
import type { Article } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 30; // Refining an article takes time

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  let token;
  try {
    token = await requireAuth(request);
  } catch (errResponse) {
    return errResponse as Response;
  }

  const { articleId } = await params;
  const userId = token.uid;

  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const article = snap.data() as Article;
  
  if (article.userId !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (article.status !== "quality_checked") {
    return Response.json(
      { error: `Cannot run SEO optimization from status '${article.status}'` },
      { status: 409 }
    );
  }

  const settings = await getSettings(userId);
  const authorProfile = {
    bio: settings.SHORT_BIO || "",
    x: settings.X_PROFILE || "",
    linkedin: settings.LINKEDIN_PROFILE || "",
    github: settings.GITHUB_PROFILE || "",
    portfolio: settings.PORTFOLIO_URL || ""
  };

  console.log(authorProfile)

  const prompt = buildSeoOptimizationPrompt(
    article.content,
    article.aiDetectionScore ?? 0,
    authorProfile
  );
  
  const model = await getModel("gemini-2.5-flash", userId);

  let rawText: string;
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    rawText = result.response.text();
  } catch (err) {
    console.error("[articles/seo-optimize] Gemini error:", err);
    return Response.json(
      { error: "Gemini call failed", detail: String(err) },
      { status: 502 }
    );
  }

  let parsed: ReturnType<typeof parseSeoResponse>;
  try {
    parsed = parseSeoResponse(rawText);
  } catch (err) {
    console.error("[articles/seo-optimize] Parse error:", err);
    return Response.json(
      { error: "Failed to parse Gemini response", raw: rawText },
      { status: 502 }
    );
  }

  await ref.update({
    status: "seo_optimized",
    content: parsed.content,
    seoTags: parsed.seoTags,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    ok: true,
    articleId,
    status: "seo_optimized",
    seoTags: parsed.seoTags
  });
}
