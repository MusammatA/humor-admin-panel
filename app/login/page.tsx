"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setMessage("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: "mea2222@columbia.edu",
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      window.location.href = "/admin";
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Login</h1>
        <p className="mt-2 text-slate-600">Sign in as mea2222@columbia.edu.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
            required
          />
          <button
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </main>
  );
}
