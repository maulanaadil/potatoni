import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Page-level gate. API routes check the JWT themselves and answer with JSON 401s.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // Public: voucher claim pages (customers) and team invite links (not signed in yet).
  if (pathname.startsWith("/v/") || pathname.startsWith("/invite/")) return NextResponse.next();

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/dashboard") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Metadata files (manifest, robots, icons, share images) and the PWA's service worker and offline
  // page must load without a session.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sw.js|offline.html|icons/|wasm/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};
