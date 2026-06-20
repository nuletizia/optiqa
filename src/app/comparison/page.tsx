"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ImageComparison } from "@/components/ImageComparison"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ComparisonPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Show loading state only when checking existing session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!session && (
          <Card className="mb-8">
            <CardContent className="p-4">
              <CardDescription className="flex items-center justify-between">
                <span>
                  Sign in to save your comparison history and contribute to global ratings.
                </span>
                <Button
                  variant="outline"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign In
                </Button>
              </CardDescription>
            </CardContent>
          </Card>
        )}
        <ImageComparison />
      </main>
    </div>
  )
} 