"use client";

import { useMemo } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const handleLogin = async () => {
    if (!supabase) {
      alert("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", border: "1px solid #ddd", borderRadius: 16, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>Admin Login</h1>
        <p style={{ marginTop: 16, fontSize: 18, color: "#334155" }}>
          Sign in with Google to continue.
        </p>
        <button
          onClick={handleLogin}
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
          }}
          type="button"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
