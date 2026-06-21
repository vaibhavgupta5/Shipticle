import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getModel } from "@/lib/gemini/client";
import {
  buildIdeaGenerationPrompt,
  parseIdeaResponse,
} from "@/lib/gemini/prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import { getWeekId } from "@/lib/firebase/firestore";
import type { Idea } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
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
  
  const userId = token.uid;
  const weekId = getWeekId();

  // ── Idempotency: don't double-generate for the same week ───────────────
  const existingSnap = await adminDb
    .collection("ideas")
    .where("userId", "==", userId)
    .where("weekId", "==", weekId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return Response.json(
      {
        error: `Ideas for ${weekId} already exist. Delete them first or wait until next week.`,
        weekId,
      },
      { status: 409 }
    );
  }

  // ── Pull all past idea titles for dedup ────────────────────────────────
  const allIdeasSnap = await adminDb
    .collection("ideas")
    .where("userId", "==", userId)
    .get();

  const existingTitles = allIdeasSnap.docs.map(
    (d) => (d.data() as Idea).title
  );

  // ── Call Gemini ────────────────────────────────────────────────────────
  const prompt = buildIdeaGenerationPrompt({ weekId, existingTitles });
  const model = await getModel("gemini-2.5-flash", userId);

  let rawText: string;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (err) {
    console.error("[ideas/generate] Gemini error:", err);
    return Response.json(
      { error: "Gemini call failed", detail: String(err) },
      { status: 502 }
    );
  }

  // ── Parse response ─────────────────────────────────────────────────────
  let ideas: ReturnType<typeof parseIdeaResponse>;
  try {
    ideas = parseIdeaResponse(rawText);
  } catch (err) {
    console.error("[ideas/generate] Parse error:", err);
    console.error("[ideas/generate] Raw Gemini response:", rawText);
    return Response.json(
      { error: "Failed to parse Gemini response", raw: rawText },
      { status: 502 }
    );
  }

  // ── Write to Firestore ─────────────────────────────────────────────────
  const batch = adminDb.batch();
  const createdIds: string[] = [];

  for (const idea of ideas.slice(0, 10)) {
    const id = randomUUID();
    createdIds.push(id);
    const ref = adminDb.collection("ideas").doc(id);
    batch.set(ref, {
      id,
      userId,
      weekId,
      title: idea.title,
      summary: idea.summary,
      angle: idea.angle,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return Response.json({
    ok: true,
    weekId,
    count: createdIds.length,
    ideas: ideas.slice(0, 10),
  });
}
