// Server-side route guard (Next.js 16 renamed `middleware` → `proxy`).
// Backoffice uses a lightweight cookie+JWT session (SPEC-003), not NextAuth: no
// bo_token cookie on a protected admin page → redirect to /login, preserving the
// requested path as `next`. The real auth check is the ops API verifying the JWT.

import { NextResponse, type NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
  const token = req.cookies.get("bo_token")?.value;
  if (!token) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Guard the admin pages only; /login, static assets and /_next are excluded.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/freelance-budgets/:path*",
    "/ftpt-salary/:path*",
    "/items/:path*",
    "/tags/:path*",
    "/inventory/:path*",
    "/reports/:path*",
    "/wallet/:path*",
    "/payroll/:path*",
  ],
};
