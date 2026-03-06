"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

async function fetchAdminStatusWithTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch("/api/admin-status", { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signinError, setSigninError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      if (!supabase) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setCheckingSession(false);
          return;
        }

        const res = await fetchAdminStatusWithTimeout(8000);
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (payload?.isSuperadmin === true || payload?.isSuperadmin === 1) {
          router.replace("/admin");
          return;
        }

        await supabase.auth.signOut();
        setSigninError("This account does not have admin access.");
        setCheckingSession(false);
      } catch (_err) {
        if (cancelled) return;
        setSigninError("Could not verify admin access. Please try again.");
        setCheckingSession(false);
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error") || "";
    if (error === "not_superadmin") {
      setSigninError("This account does not have admin access.");
      return;
    }
    if (error === "missing_env") {
      setSigninError("Missing Supabase environment variables.");
      return;
    }
    setSigninError(error);
  }, []);

  const handleLogin = async () => {
    if (!supabase) {
      alert("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setSigninError("");
    setSigningIn(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setSigninError(error.message);
      setSigningIn(false);
      return;
    }
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    setSigninError("Could not start Google sign-in. Please try again.");
    setSigningIn(false);
  };

  return (
    <main style={{ minHeight: "100vh", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", border: "1px solid #ddd", borderRadius: 16, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>Admin Login</h1>
        {checkingSession ? (
          <p style={{ marginTop: 12, fontSize: 14, color: "#64748b" }}>Checking existing session...</p>
        ) : null}
        {signinError ? (
          <p style={{ marginTop: 12, fontSize: 14, color: "#b91c1c" }}>
            Sign-in failed ({signinError}). Try again.
          </p>
        ) : null}
        <p style={{ marginTop: 16, fontSize: 18, color: "#334155" }}>
          Sign in with Google. Access is granted only if your profile has <code>is_superadmin = true</code>.
        </p>
        <button
          onClick={handleLogin}
          disabled={signingIn}
          style={{
            marginTop: 20,
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            background: "#0f172a",
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            cursor: "pointer",
            opacity: signingIn ? 0.7 : 1,
          }}
          type="button"
        >
          {signingIn ? "Redirecting to Google..." : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}
