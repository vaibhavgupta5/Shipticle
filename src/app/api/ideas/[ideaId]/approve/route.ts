import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { FieldValue } from "firebase-admin/firestore";
import type { Idea } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  try {
    await requireAuth(request);
  } catch (errResponse) {
    return errResponse as Response;
  }

  const { ideaId } = await params;

  // ── Verify the target idea exists ──────────────────────────────────────
  const ideaRef = adminDb.collection("ideas").doc(ideaId);
  const ideaSnap = await ideaRef.get();

  if (!ideaSnap.exists) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }

  const idea = { id: ideaSnap.id, ...ideaSnap.data() } as Idea;
  
  const token = await requireAuth(request);
  if (idea.userId !== token.uid) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (idea.status !== "pending") {
    return Response.json({ error: `Idea is already ${idea.status}` }, { status: 400 });
  }

  // ── Fetch all sibling ideas for the same week ──────────────────────────
  const siblingsSnap = await adminDb
    .collection("ideas")
    .where("userId", "==", idea.userId)
    .where("weekId", "==", idea.weekId)
    .get();

  // ── Batch: approve target, reject all others ───────────────────────────
  const batch = adminDb.batch();
  const now = FieldValue.serverTimestamp();

  for (const doc of siblingsSnap.docs) {
    if (doc.id === ideaId) {
      batch.update(doc.ref, { status: "approved", updatedAt: now });
    } else if ((doc.data() as Idea).status === "pending") {
      batch.update(doc.ref, { status: "rejected", updatedAt: now });
    }
  }

  await batch.commit();

  return Response.json({ ok: true, approvedId: ideaId, weekId: idea.weekId });
}
