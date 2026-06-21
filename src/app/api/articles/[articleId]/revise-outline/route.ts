import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getModel } from "@/lib/gemini/client";
import {
  buildOutlineRevisionPrompt,
  parseOutlineResponse,
} from "@/lib/gemini/outline-prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import type { Article, Idea } from "@/lib/types";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 10;

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
  const { userNotes } = (await request.json()) as { userNotes: string };
  const userId = token.uid;

  if (!userNotes?.trim()) {
    return Response.json({ error: "userNotes cannot be empty" }, { status: 400 });
  }

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

  if (article.status !== "outline_pending") {
    return Response.json(
      { error: `Can only revise an outline when status is 'outline_pending', got '${article.status}'` },
      { status: 409 }
    );
  }

  if (!article.outline) {
    return Response.json({ error: "Article has no outline to revise" }, { status: 400 });
  }

  // ── Fetch parent idea for context ──────────────────────────────────────
  const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
  const idea = { id: ideaSnap.id, ...ideaSnap.data() } as Idea;

  // ── Call Gemini ────────────────────────────────────────────────────────
  const prompt = buildOutlineRevisionPrompt(article.outline, userNotes, idea);
  const model = await getModel("gemini-2.5-flash", userId);

  let rawText: string;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (err) {
    console.error("[articles/revise-outline] Gemini error:", err);
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
    console.error("[articles/revise-outline] Parse error:", err);
    return Response.json(
      { error: "Failed to parse Gemini response", raw: rawText },
      { status: 502 }
    );
  }

  // ── Write: push old outline to history, set new outline ───────────────
  //
  // Version history design: we store the full outlineHistory[] array on the
  // article doc (not a sub-collection). Each entry is an OutlineDoc snapshot.
  // Rationale: revision loops are typically < 5 iterations; the array stays
  // well under Firestore's 1MB document limit; and it avoids the extra round
  // trip of a sub-collection query on every page load.
  //
  const oldOutlineForHistory = {
    sections: article.outline.sections,
    generatedAt: article.outline.generatedAt ?? Timestamp.now(),
    userNotesThatTriggeredRevision: userNotes,
  };

  const newOutline = {
    sections: parsed.outline.sections,
    generatedAt: Timestamp.now(),
  };

  await ref.update({
    outline: newOutline,
    outlineHistory: FieldValue.arrayUnion(oldOutlineForHistory),
    researchLinks: parsed.researchLinks,
    researchPrompts: parsed.researchPrompts,
    userNotes,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    ok: true,
    articleId,
    revisionCount: (article.outlineHistory?.length ?? 0) + 1,
  });
}
