import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    const res = NextResponse.next();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();

    if (error || profile?.is_superadmin !== true) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return res;
  } catch (_error) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"], // protect admin routes
};
