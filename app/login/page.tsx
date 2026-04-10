"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

const REMEMBER_SESSION_STORAGE_KEY = "admin_remember_session";

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
  const [rememberSession, setRememberSession] = useState(true);

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
    const storedPreference = window.localStorage.getItem(REMEMBER_SESSION_STORAGE_KEY);
    if (storedPreference === "0") {
      setRememberSession(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error") || "";
    if (error === "domain_not_allowed") {
      setSigninError("This email domain is not allowed for access.");
      return;
    }
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
    window.localStorage.setItem(REMEMBER_SESSION_STORAGE_KEY, rememberSession ? "1" : "0");

    await supabase.auth.signOut();

    const callbackUrl = `${window.location.origin}/auth/callback?remember=${rememberSession ? "1" : "0"}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: rememberSession
          ? undefined
          : {
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
    <main className="relative min-h-screen overflow-hidden px-6 py-10 sm:px-10">
      <div className="login-cinema-orb login-cinema-orb-a" aria-hidden />
      <div className="login-cinema-orb login-cinema-orb-b" aria-hidden />
      <div className="login-cinema-grid" aria-hidden />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center justify-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white/92 p-8 text-center shadow-lg backdrop-blur-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Shield className="h-6 w-6 text-slate-700" />
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Admin Login</h1>
          <p className="mt-3 text-sm text-slate-500">Sign in with Google to continue.</p>

          {checkingSession ? (
            <p className="mx-auto mt-6 max-w-md rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Checking existing session...
            </p>
          ) : null}
          {signinError ? (
            <p className="mx-auto mt-6 max-w-md rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              Sign-in failed ({signinError}). Try again.
            </p>
          ) : null}

          <button
            onClick={handleLogin}
            disabled={signingIn}
            className="mx-auto mt-8 inline-flex w-full max-w-md items-center justify-center rounded-xl px-5 py-4 text-lg font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
              boxShadow: "0 14px 28px rgba(39, 47, 56, 0.22)",
            }}
            type="button"
          >
            {signingIn ? "Redirecting to Google..." : "Sign in with Google"}
          </button>

          <label className="mx-auto mt-5 flex w-full max-w-md cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">
            <input
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-800">Stay signed in</span>
              <span className="block text-xs text-slate-500">
                Keep this admin session on this browser so returning is faster.
              </span>
            </span>
          </label>

          <p className="mt-4 text-xs text-slate-500">
            You will be redirected back to this website after Google authentication.
          </p>
        </div>
      </section>
    </main>
  );
}
