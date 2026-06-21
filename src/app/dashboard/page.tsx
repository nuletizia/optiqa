"use client"

import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { ComparisonsToGrade } from "@/components/dashboard/ComparisonsToGrade"

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()

  // Check if user has an organization
  const hasOrganization = session?.user?.organizationId

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {session?.user?.name ? `Welcome, ${session.user.name}!` : "Welcome to OptiQA!"}
            </CardTitle>
            {!session?.user && (
              <CardDescription>
                Sign in to save your comparison history and contribute to global ratings.
                You can still use local comparisons without an account.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Usual actions - Different based on organization membership */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hasOrganization ? (
                <>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle>View History</CardTitle>
                      <CardDescription>Access your previous comparison results and analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Review past comparisons and download detailed results
                      </p>
                      <Link href="/dashboard/comparisons">
                        <Button className="w-full">View Comparison History</Button>
                      </Link>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle>Live Ratings</CardTitle>
                      <CardDescription>View organization ratings and rankings across all products</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Track performance and compare different model versions
                      </p>
                      <Button onClick={() => router.push('/dashboard/ratings')} className="w-full">
                        View Ratings
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle>Join Organization</CardTitle>
                      <CardDescription>Join an existing organization to collaborate with others</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Request access to an organization and contribute to their ratings
                      </p>
                      <Link href="/dashboard/organization/join">
                        <Button className="w-full">Join Organization</Button>
                      </Link>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle>Create Organization</CardTitle>
                      <CardDescription>Start your own organization for quality assessment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a new organization and invite team members
                      </p>
                      <Link href="/dashboard/organization/create">
                        <Button className="w-full">Create Organization</Button>
                      </Link>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Ad-hoc entry — small inline link into the comparison engine */}
            <p className="text-center text-sm text-muted-foreground">
              Just need a one-off check?{' '}
              <Link href="/comparison" className="text-primary underline underline-offset-4">
                Compare two folders directly
              </Link>
              .
            </p>

            {/* Org members: comparisons available to grade (at the bottom) */}
            {hasOrganization && (
              <>
                <Separator />
                <ComparisonsToGrade />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 