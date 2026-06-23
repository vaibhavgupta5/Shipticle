import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

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
