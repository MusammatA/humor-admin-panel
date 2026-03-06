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

async function fetchAdminEmailAllowedWithTimeout(email: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const encoded = encodeURIComponent(email);
    return await fetch(`/api/admin-email-allowed?email=${encoded}`, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signinError, setSigninError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

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
    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      setSigninError("Enter a valid admin email.");
      return;
    }

    setSigninError("");
    setSigningIn(true);

    try {
      const allowedRes = await fetchAdminEmailAllowedWithTimeout(normalizedEmail, 10000);
      const allowedPayload = await allowedRes.json().catch(() => ({}));
      const allowed = allowedPayload?.allowed === true;
      const indeterminate = allowedPayload?.indeterminate === true;
      if (!allowed) {
        setSigningIn(false);
        if (indeterminate) {
          setSigninError(String(allowedPayload?.error || "Could not verify admin email. Try again."));
          return;
        }
        setSigninError("This email does not have superadmin access.");
        return;
      }
    } catch (_err) {
      setSigningIn(false);
      setSigninError("Could not verify admin email. Try again.");
      return;
    }

    await supabase.auth.signOut();

    const callbackUrl = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
          login_hint: normalizedEmail,
        },
      },
    });

    if (error) {
      setSigninError(error.message);
      setSigningIn(false);
      return;
    }
    if (data?.url) {
      try {
        const oauthUrl = new URL(data.url);
        const redirectTarget = oauthUrl.searchParams.get("redirect_to") || "";
        if (!redirectTarget || !redirectTarget.startsWith(window.location.origin)) {
          setSigninError(
            `OAuth redirect mismatch. Expected ${window.location.origin}, got ${redirectTarget || "missing redirect_to"}. Update Supabase Auth redirect URLs.`,
          );
          setSigningIn(false);
          return;
        }
      } catch (_err) {
        setSigninError("Could not validate OAuth redirect URL.");
        setSigningIn(false);
        return;
      }
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
          Enter your admin email, then continue with Google sign-in.
        </p>
        <label
          htmlFor="admin-email"
          style={{ marginTop: 12, display: "block", fontSize: 12, fontWeight: 700, color: "#64748b" }}
        >
          Admin Email
        </label>
        <input
          id="admin-email"
          type="email"
          value={adminEmail}
          onChange={(event) => setAdminEmail(event.target.value)}
          placeholder="your-admin-email@domain.com"
          style={{
            marginTop: 8,
            width: "100%",
            maxWidth: 420,
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 16,
          }}
        />
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
