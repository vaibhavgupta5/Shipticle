import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
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

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.diagrams)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const article = snap.data() as Article;

  const updatedSpecs = [...(article.diagramSpecs || [])];
  let updatedCount = 0;

  for (const update of body.diagrams) {
    const idx = updatedSpecs.findIndex(s => s.id === update.id);
    if (idx !== -1) {
      updatedSpecs[idx] = { ...updatedSpecs[idx], svgContent: update.svgContent };
      updatedCount++;
    }
  }

  await ref.update({
    diagramSpecs: updatedSpecs,
  });

  return Response.json({ ok: true, articleId, updatedCount });
}
