import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// List of public paths that don't require authentication
const publicPaths = [
  "/auth",
  "/api/auth",
  "/",
  "/_next",
  "/favicon.ico",
  "/callback",  // OAuth callback path
  "/signin",    // Additional sign-in related paths
  "/signout",
  "/error",
  "/comparison"  // Allow access to the comparison page without authentication
]

export function middleware(request: NextRequest) {
  // Check if auth is disabled via environment variable
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Check if the current path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth session cookie
  const authCookie = request.cookies.get("next-auth.session-token") ||
                    request.cookies.get("__Secure-next-auth.session-token")

  if (!authCookie) {
    // Store the original URL to redirect back after login
    const callbackUrl = request.nextUrl.pathname + request.nextUrl.search
    const signInUrl = new URL("/auth/signin", request.url)
    signInUrl.searchParams.set("callbackUrl", callbackUrl)
    
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

// Update config to be more specific about protected routes
export const config = {
  matcher: [
    // Protect all routes except public ones
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico|callback|signin|signout|error|comparison).*)",
    // Optional: Protect specific API routes
    "/api/comparisons/:path*",
  ]
} 