import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE_OPTIONS = {
  name: "__session",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",

  maxAge: 60 * 60 * 24 * 5,
};

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing id token" }, { status: 400 });
    }

    await adminAuth.verifyIdToken(idToken);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_OPTIONS.name, idToken, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("__session");
  return response;
}
