import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Verifies the __session cookie in an API route request.
 * Returns the decoded token on success, throws a Response on failure.
 *
 * Usage:
 *   const token = await requireAuth(request)
 *   // token.uid is the verified Firebase UID
 */
export async function requireAuth(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;

  if (!session) {
    throw new Response(
      JSON.stringify({ error: "Unauthenticated" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(session);
    return decoded;
  } catch {
    throw new Response(
      JSON.stringify({ error: "Invalid session" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
}
