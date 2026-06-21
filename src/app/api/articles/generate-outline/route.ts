import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getModel } from "@/lib/gemini/client";
import {
  buildOutlineGenerationPrompt,
  parseOutlineResponse,
} from "@/lib/gemini/outline-prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import { getWeekId } from "@/lib/firebase/firestore";
import type { Idea } from "@/lib/types";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  let token;
  try {
    token = await requireAuth(request);
  } catch (errResponse) {
    return errResponse as Response;
  }

  const body = await request.json();
  const { ideaId } = body as { ideaId: string };
  const userId = token.uid;

  if (!ideaId) {
    return Response.json({ error: "ideaId is required" }, { status: 400 });
  }

  // ── Fetch the idea ─────────────────────────────────────────────────────
  const ideaSnap = await adminDb.collection("ideas").doc(ideaId).get();
  if (!ideaSnap.exists) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }

  const idea = { id: ideaSnap.id, ...ideaSnap.data() } as Idea;
  
  if (idea.userId !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (idea.status !== "approved") {
    return Response.json(
      { error: `Idea must be 'approved' to generate an outline, got '${idea.status}'` },
      { status: 409 }
    );
  }

  // ── Idempotency: return existing article if one already exists ─────────
  if (idea.articleId) {
    const existing = await adminDb.collection("articles").doc(idea.articleId).get();
    if (existing.exists) {
      return Response.json({ ok: true, articleId: idea.articleId, existing: true });
    }
  }

  // ── Call Gemini ────────────────────────────────────────────────────────
  const prompt = buildOutlineGenerationPrompt(idea);
  const model = await getModel("gemini-2.5-flash", userId);

  let rawText: string;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (err) {
    console.error("[articles/generate-outline] Gemini error:", err);
    return Response.json(
      { error: "Gemini call failed", detail: String(err) },
      { status: 502 }
    );
  }

  // ── Parse ──────────────────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseOutlineResponse>;
  try {
    parsed = parseOutlineResponse(rawText);
  } catch (err) {
    console.error("[articles/generate-outline] Parse error:", err);
    console.error("[articles/generate-outline] Raw response:", rawText);
    return Response.json(
      { error: "Failed to parse Gemini response", raw: rawText },
      { status: 502 }
    );
  }

  // ── Write article doc ──────────────────────────────────────────────────
  const articleId = randomUUID();
  const now = FieldValue.serverTimestamp();

  const outlineForFirestore = {
    sections: parsed.outline.sections,
    generatedAt: Timestamp.now(),
  };

  await adminDb
    .collection("articles")
    .doc(articleId)
    .set({
      id: articleId,
      userId,
      ideaId,
      weekId: idea.weekId ?? getWeekId(),
      status: "outline_pending",

      outline: outlineForFirestore,
      outlineHistory: [],
      researchLinks: parsed.researchLinks,
      researchPrompts: parsed.researchPrompts,
      userNotes: "",

      content: "",
      diagramSpecs: [],

      aiDetectionScore: null,
      plagiarismScore: null,
      plagiarismSources: [],

      heroImageUrl: null,
      promptTemplateId: null,

      createdAt: now,
      updatedAt: now,
    });

  // ── Stamp articleId onto the idea doc ──────────────────────────────────
  await adminDb.collection("ideas").doc(ideaId).update({
    articleId,
    updatedAt: now,
  });

  return Response.json({ ok: true, articleId });
}
