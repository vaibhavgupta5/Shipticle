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

  // TODO: Integrate actual AI detection and plagiarism APIs based on user choice.
  // For now, we mock the response to unblock the UI flow.
  const mockAiDetectionScore = Math.floor(Math.random() * 20); // 0-19%
  const mockPlagiarismScore = Math.floor(Math.random() * 5); // 0-4%
  const mockPlagiarismSources = mockPlagiarismScore > 0 ? ["https://example.com/source1"] : [];

  await ref.update({
    status: "quality_checked",
    aiDetectionScore: mockAiDetectionScore,
    plagiarismScore: mockPlagiarismScore,
    plagiarismSources: mockPlagiarismSources,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    ok: true,
    articleId,
    status: "quality_checked",
    scores: {
      aiDetectionScore: mockAiDetectionScore,
      plagiarismScore: mockPlagiarismScore,
      plagiarismSources: mockPlagiarismSources,
    }
  });
}
