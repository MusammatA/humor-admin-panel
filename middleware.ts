import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  void req;
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
