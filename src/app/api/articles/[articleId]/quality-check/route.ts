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

  if (article.status !== "content_approved") {
    return Response.json(
      { error: `Cannot run quality check from status '${article.status}'` },
      { status: 409 }
    );
  }

  const cleanText = article.content.replace(/[#*`_\[\]]/g, '').slice(0, 2500);

  let aiDetectionScore = 0;

  try {
    const hfRes = await fetch("https://api-inference.huggingface.co/models/roberta-base-openai-detector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: cleanText })
    });

    if (hfRes.ok) {
      const data = await hfRes.json();

      if (Array.isArray(data) && Array.isArray(data[0])) {
        const fakeScoreObj = data[0].find((item) => item.label === "Fake");
        if (fakeScoreObj) {
          aiDetectionScore = Math.round(fakeScoreObj.score * 100);
        }
      }
    } else {
      console.warn("Hugging Face API error:", await hfRes.text());

    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("[articles/quality-check] HF AI Detection error:", errorMsg);
  }

  await ref.update({
    status: "quality_checked",
    aiDetectionScore,
    plagiarismScore: null,
    plagiarismSources: [],
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    ok: true,
    articleId,
    status: "quality_checked",
    scores: {
      aiDetectionScore,
      plagiarismScore: null,
      plagiarismSources: [],
    }
  });
}
