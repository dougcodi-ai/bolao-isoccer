import { NextResponse } from 'next/server'

// Stub endpoint to avoid timeouts from stray calls in the client.
// Returns OK immediately.
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST() {
  return NextResponse.json({ ok: true })
}