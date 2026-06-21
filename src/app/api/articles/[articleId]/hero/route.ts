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

  if (!body || typeof body.heroImageUrl !== "string") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  await ref.update({
    heroImageUrl: body.heroImageUrl,
  });

  return Response.json({ ok: true, articleId });
}
