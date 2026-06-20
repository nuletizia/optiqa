import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  
  return NextResponse.json({
    authenticated: !!session?.user,
    userId: session?.user?.id || null
  })
} 