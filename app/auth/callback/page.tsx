"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const completeSignIn = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("Missing Supabase environment variables.");
        }

        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          if (mounted) {
            router.replace(`/auth/confirm?code=${encodeURIComponent(code)}`);
          }
          return;
        } else {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();
          if (error) throw error;
          if (!session) throw new Error("No active session found.");
        }

        if (mounted) router.replace("/admin");
      } catch (_error) {
        if (mounted) router.replace("/login?error=signin_failed");
      }
    };

    void completeSignIn();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
      <p>Completing sign-in...</p>
    </main>
  );
}
