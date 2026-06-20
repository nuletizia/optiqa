import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  
  return NextResponse.redirect(new URL(callbackUrl, request.url))
} 