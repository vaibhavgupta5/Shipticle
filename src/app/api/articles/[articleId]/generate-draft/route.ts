import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getModel } from "@/lib/gemini/client";
import {
  buildArticleGenerationPrompt,
  parseArticleResponse,
  DEFAULT_ARTICLE_SYSTEM_PROMPT,
} from "@/lib/gemini/article-prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import type { Article, Idea, PromptTemplate } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30; // Article generation takes longer

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

  // ── Fetch article ──────────────────────────────────────────────────────
  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const article = snap.data() as Article;
  
  if (article.userId !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (article.status !== "outline_approved" && article.status !== "draft_generated") {
    return Response.json(
      { error: `Cannot generate draft from status '${article.status}'` },
      { status: 409 }
    );
  }

  if (!article.outline) {
    return Response.json({ error: "Article has no approved outline" }, { status: 400 });
  }

  // ── Fetch parent idea ──────────────────────────────────────────────────
  const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
  const idea = { id: ideaSnap.id, ...ideaSnap.data() } as Idea;

  // ── Fetch Custom System Prompt (if configured) ───────────────────────
  let systemPrompt = DEFAULT_ARTICLE_SYSTEM_PROMPT;
  try {
    const templatesSnap = await adminDb
      .collection("promptTemplates")
      .where("userId", "==", userId)
      .where("type", "==", "article_generation")
      .where("isDefault", "==", true)
      .limit(1)
      .get();
      
    if (!templatesSnap.empty) {
      systemPrompt = templatesSnap.docs[0].data().systemPrompt;
    }
  } catch (err) {
    console.warn("Could not fetch custom prompt template, using default.", err);
  }

  // ── Call Gemini ────────────────────────────────────────────────────────
  const prompt = buildArticleGenerationPrompt(
    idea,
    article.outline,
    article.researchLinks || [],
    article.userNotes || "",
    systemPrompt
  );
  
  const model = await getModel("gemini-2.5-flash", userId);

  let rawText: string;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (err) {
    console.error("[articles/generate-draft] Gemini error:", err);
    return Response.json(
      { error: "Gemini call failed", detail: String(err) },
      { status: 502 }
    );
  }

  // ── Parse ──────────────────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseArticleResponse>;
  try {
    parsed = parseArticleResponse(rawText);
  } catch (err) {
    console.error("[articles/generate-draft] Parse error:", err);
    return Response.json(
      { error: "Failed to parse Gemini response", raw: rawText },
      { status: 502 }
    );
  }

  // ── Write draft and specs ─────────────────────────────────────────────
  
  // Assign UUIDs to diagram specs
  const diagramSpecs = parsed.diagramSpecs.map(spec => ({
    ...spec,
    id: randomUUID(),
    svgContent: null // To be populated in Phase 5
  }));

  await ref.update({
    status: "draft_generated",
    content: parsed.markdown,
    diagramSpecs,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    ok: true,
    articleId,
    status: "draft_generated",
  });
}
