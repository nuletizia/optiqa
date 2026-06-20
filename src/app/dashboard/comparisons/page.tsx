"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface ComparisonResult {
  id: string
  createdAt: string
  directoryV1: string
  directoryV2: string
  scoreV1: number
  scoreV2: number
  totalComparisons: number
  detailedResults: string | null
}

export default function ComparisonsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Redirect to sign in if not authenticated
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    // Only fetch comparisons if authenticated
    if (status === "authenticated") {
      const fetchComparisons = async () => {
        try {
          const response = await fetch("/api/comparisons")
          if (!response.ok) throw new Error("Failed to fetch comparisons")
          const data = await response.json()
          setComparisons(data)
        } catch (error) {
          console.error("Error fetching comparisons:", error)
        } finally {
          setLoading(false)
        }
      }

      fetchComparisons()
    }
  }, [status, router])

  const handleDownload = (comparison: ComparisonResult) => {
    if (!comparison.detailedResults) {
      console.error('No detailed results available for this comparison');
      return;
    }

    // Create and trigger download of the detailed results
    const blob = new Blob([comparison.detailedResults], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `comparison-${comparison.id}-${new Date(comparison.createdAt).toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Show loading state while checking authentication
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Comparison History</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading your comparisons...</p>
          </div>
        ) : comparisons.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900">No comparisons yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start a new comparison to see your results here.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/comparison")}
                >
                  Start New Comparison
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {comparisons.map((comparison) => (
              <Card key={comparison.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      Comparison from {new Date(comparison.createdAt).toLocaleDateString()}
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => handleDownload(comparison)}
                      disabled={!comparison.detailedResults}
                      title={comparison.detailedResults ? 
                        "Download detailed results" : 
                        "No detailed results available for this comparison"}
                    >
                      <Download className="h-4 w-4" />
                      Download Detailed Results
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-medium mb-2">{comparison.directoryV1}</h4>
                      <p className="text-3xl font-bold">{comparison.scoreV1}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">{comparison.directoryV2}</h4>
                      <p className="text-3xl font-bold">{comparison.scoreV2}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    Total comparisons: {comparison.totalComparisons}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
} 