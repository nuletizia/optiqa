"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"

export default function SignIn() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleSignIn = async () => {
    try {
      await signIn("google", {
        callbackUrl: callbackUrl,
        redirect: true,
      })
    } catch (error) {
      console.error("Sign in error:", error)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-2xl border bg-white p-8 shadow-lg">
        <div className="space-y-4">
          <div className="flex justify-center">
            <img 
              src="/logo.png" 
              alt="OptiQA Logo" 
              className="h-16 w-16"
            />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight">
            OptiQA
          </h1>
          <p className="text-center text-gray-600">
            Sign in to access optimal quality assessment tools
          </p>
        </div>

        <Button
          className="w-full flex items-center justify-center space-x-2 py-6 text-lg bg-[#006A93] hover:bg-[#00B4D8]"
          onClick={handleSignIn}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Sign in with Google</span>
        </Button>
      </div>
    </div>
  )
} 