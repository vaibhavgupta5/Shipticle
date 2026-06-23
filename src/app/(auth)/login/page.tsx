"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}


import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";

  const [loading, setLoading] = useState<"google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google") {
    setLoading(provider);
    setError(null);

    try {
      const authProvider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, authProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      router.push(from);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      if (msg.includes("popup-closed")) {
        setError(null);
      } else if (msg.includes("auth/unauthorized-domain")) {
        setError("This domain is not authorized for OAuth operations. Please add your current URL to the Authorized Domains list in your Firebase Authentication console.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="rounded-2xl border p-8 shadow-2xl"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tighter text-foreground">
          Shipticle<span className="text-primary">.</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          AI editorial pipeline — sign in to continue
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          id="sign-in-google"
          type="button"
          onClick={() => signIn("google")}
          disabled={loading !== null}
          className="relative flex items-center justify-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "hsl(var(--secondary))",
            color: "hsl(var(--secondary-foreground))",
            border: "1px solid hsl(var(--border))",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "hsl(var(--muted))")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "hsl(var(--secondary))")
          }
        >
          {loading === "google" ? (
            <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>


      </div>

      {error && (
        <p
          className="mt-4 text-center text-sm rounded-lg px-3 py-2"
          style={{
            color: "hsl(var(--destructive))",
            background: "hsl(var(--destructive) / 0.1)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
