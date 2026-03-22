import { NextResponse } from "next/server"

/**
 * Server-only proxy to Modal LobotomyAdmin (CPU).
 * Set MODAL_ADMIN_URL_GET, MODAL_ADMIN_URL_SET, and ADMIN_TOKEN (or MODAL_ADMIN_TOKEN) in .env.local. Never expose the token to the client.
 */

function getToken(): string | undefined {
  return (process.env.MODAL_ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)?.trim() || undefined
}

export async function GET() {
  const url = process.env.MODAL_ADMIN_URL_GET?.trim()
  const token = getToken()
  if (!url || !token) {
    return NextResponse.json(
      { error: "Server missing MODAL_ADMIN_URL_GET or MODAL_ADMIN_TOKEN / ADMIN_TOKEN" },
      { status: 503 }
    )
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const url = process.env.MODAL_ADMIN_URL_SET?.trim()
  const token = getToken()
  if (!url || !token) {
    return NextResponse.json(
      { error: "Server missing MODAL_ADMIN_URL_SET or MODAL_ADMIN_TOKEN / ADMIN_TOKEN" },
      { status: 503 }
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
