import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { FieldValue } from "firebase-admin/firestore";
import type { Article, Publication } from "@/lib/types";
import { platforms, PLATFORM_IDS } from "@/lib/platforms";

export const runtime = "nodejs";

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
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.selectedPlatforms)) {
    return Response.json({ error: "Invalid payload: missing selectedPlatforms" }, { status: 400 });
  }

  const selectedSet = new Set(body.selectedPlatforms);
  if (selectedSet.size > 2) {
    return Response.json({ error: "Cannot select more than 2 platforms at once." }, { status: 400 });
  }

  const ref = adminDb.collection("articles").doc(articleId);
  const snap = await ref.get();

  if (!snap.exists) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const article = { id: snap.id, ...snap.data() } as Article;

  if (article.userId !== token.uid) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (article.status !== "quality_checked" && article.status !== "seo_optimized" && article.status !== "published") {
    return Response.json(
      { error: `Cannot publish from status '${article.status}'` },
      { status: 409 }
    );
  }

  const results: Record<string, { status: string; platformUrl?: string; errorMessage?: string }> = {};
  let anySuccess = false;

  for (const platId of PLATFORM_IDS) {
    const adapter = platforms[platId];
    if (!adapter) continue; // Not implemented yet (e.g. medium)

    const pubRef = adminDb.collection("publications").doc(`${articleId}_${platId}`);

    if (selectedSet.has(platId)) {

      const res = await adapter.publish(article);
      
      const pubDoc: Partial<Publication> = {
        id: pubRef.id,
        userId: article.userId,
        articleId,
        platform: platId as Publication["platform"],
        status: res.status,
        platformUrl: res.platformUrl || null,
        errorMessage: res.errorMessage || null,
        attemptedAt: FieldValue.serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
      };

      if (res.status === "posted") {
        pubDoc.succeededAt = FieldValue.serverTimestamp() as unknown as import("firebase/firestore").Timestamp;
        anySuccess = true;
      }

      await pubRef.set(pubDoc, { merge: true });
      results[platId] = res;
    } else {

      const existing = await pubRef.get();
      if (!existing.exists || existing.data()?.status !== "posted") {
        await pubRef.set({
          id: pubRef.id,
          userId: article.userId,
          articleId,
          platform: platId,
          status: "stored_unpublished",
          attemptedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }

  if (anySuccess) {
    const publishedUrls: Record<string, string> = { ...(article.publishedUrls || {}) };
    for (const platId of Object.keys(results)) {
      if (results[platId].status === "posted" && results[platId].platformUrl) {
        publishedUrls[platId] = results[platId].platformUrl;
      }
    }

    await ref.update({
      ...(article.status !== "published" ? { status: "published" } : {}),
      publishedUrls,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return Response.json({
    ok: true,
    articleId,
    results,
    overallStatus: anySuccess ? "published" : article.status,
  });
}
