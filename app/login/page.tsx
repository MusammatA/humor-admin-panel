"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signinError, setSigninError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [checkingAdminEmail, setCheckingAdminEmail] = useState(false);

  async function precheckAdminEmail(email: string) {
    try {
      const res = await fetch(`/api/admin-email-allowed?email=${encodeURIComponent(email)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      return payload?.allowed === true;
    } catch (_err) {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      if (!supabase) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        router.replace("/admin");
        return;
      }
      setCheckingSession(false);
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error") || "";
    setSigninError(error);
  }, []);

  const handleLogin = async () => {
    if (!supabase) {
      alert("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setSigninError("Enter your admin email first.");
      return;
    }

    setSigninError("");
    setCheckingAdminEmail(true);
    const allowed = await precheckAdminEmail(normalizedEmail);
    if (!allowed) {
      setSigninError("Sorry, you don't have Supabase access.");
      setCheckingAdminEmail(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
          login_hint: normalizedEmail,
        },
      },
    });

    if (error) {
      setSigninError(error.message);
      setCheckingAdminEmail(false);
    }
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
          Sign in with Google to continue.
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
          disabled={checkingAdminEmail}
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
            opacity: checkingAdminEmail ? 0.7 : 1,
          }}
          type="button"
        >
          {checkingAdminEmail ? "Checking admin access..." : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}
