"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Sparkles } from "lucide-react";
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

    await supabase.auth.signOut();

    const callbackUrl = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
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

      <section className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-8 shadow-lg backdrop-blur-sm">
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <Sparkles className="h-3.5 w-3.5" />
            Superadmin Portal
          </p>
          <h1 className="mt-4 text-5xl font-bold leading-[0.95] text-slate-900 sm:text-6xl">Admin Login</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-700">
            Secure access for Humor Study administrators. Only authenticated Google users with
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-base">profiles.is_superadmin = true</code>
            can enter this dashboard.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">Google OAuth required</div>
            <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">Server-side role check</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/92 p-7 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Shield className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-slate-900">Sign In</h2>
          </div>

          {checkingSession ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Checking existing session...
            </p>
          ) : null}
          {signinError ? (
            <p className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              Sign-in failed ({signinError}). Try again.
            </p>
          ) : null}

          <button
            onClick={handleLogin}
            disabled={signingIn}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-4 text-lg font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
              boxShadow: "0 14px 28px rgba(39, 47, 56, 0.22)",
            }}
            type="button"
          >
            {signingIn ? "Redirecting to Google..." : "Sign in with Google"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            You will be redirected back to this website after Google authentication.
          </p>
        </div>
      </section>
    </main>
  );
}
