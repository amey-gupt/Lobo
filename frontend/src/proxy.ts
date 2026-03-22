import { auth0 } from "@/lib/auth0"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isAuthRoute = pathname.startsWith("/auth")
  const isApiRoute = pathname.startsWith("/api")

  if (isApiRoute) return NextResponse.next()

  const res = await auth0.middleware(req)

  if (!isAuthRoute) {
    let session
    try {
      session = await auth0.getSession(req)
    } catch (e) {
      console.error("[proxy] getSession error:", e)
    }
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
