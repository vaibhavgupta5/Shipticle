import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { FieldValue } from "firebase-admin/firestore";
import type { Article } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    await requireAuth(request);
  } catch (errResponse) {
    return errResponse as Response;
  }

  const { articleId } = await params;
  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const article = snap.data() as Article;

  if (article.status !== "draft_generated") {
    return Response.json(
      { error: `Expected status 'draft_generated', got '${article.status}'` },
      { status: 409 }
    );
  }

  await ref.update({
    status: "content_approved",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({ ok: true, articleId, status: "content_approved" });
}
