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

  const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
  const idea = { id: ideaSnap.id, ...ideaSnap.data() } as Idea;

  const prompt = buildOutlineRevisionPrompt(article.outline, userNotes, idea);
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
    console.error("[articles/revise-outline] Gemini error:", err);
    return Response.json(
      { error: "Gemini call failed", detail: String(err) },
      { status: 502 }
    );
  }

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
