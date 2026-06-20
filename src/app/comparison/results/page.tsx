"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from 'next/link'

interface ComparisonResults {
  directoryV1: string;
  directoryV2: string;
  scoreV1: number;
  scoreV2: number;
  totalComparisons: number;
  detailedResults: string;
  directoryNameV1?: string;
  directoryNameV2?: string;
  usePersistentRatings?: boolean;
  authenticated?: boolean;
}

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [results, setResults] = useState<ComparisonResults | null>(null);

  useEffect(() => {
    // Try to get data from the 'data' parameter (JSON string)
    const data = searchParams.get('data')
    if (data) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(data))
        setResults(parsedData)
        return
      } catch (error) {
        console.error('Error parsing results data:', error)
      }
    }
    
    // If no 'data' parameter or parsing failed, try to construct from individual query parameters
    const directoryV1 = searchParams.get('directoryV1')
    const directoryV2 = searchParams.get('directoryV2')
    const directoryNameV1 = searchParams.get('directoryNameV1')
    const directoryNameV2 = searchParams.get('directoryNameV2')
    const scoreV1 = searchParams.get('scoreV1')
    const scoreV2 = searchParams.get('scoreV2')
    const totalComparisons = searchParams.get('totalComparisons')
    const detailedResults = searchParams.get('detailedResults')
    const usePersistentRatings = searchParams.get('usePersistentRatings')
    const authenticated = searchParams.get('authenticated')
    
    if (directoryV1 && directoryV2 && scoreV1 && scoreV2 && totalComparisons) {
      setResults({
        directoryV1,
        directoryV2,
        directoryNameV1: directoryNameV1 || directoryV1,
        directoryNameV2: directoryNameV2 || directoryV2,
        scoreV1: parseFloat(scoreV1),
        scoreV2: parseFloat(scoreV2),
        totalComparisons: parseInt(totalComparisons),
        detailedResults: detailedResults || '',
        usePersistentRatings: usePersistentRatings === 'true',
        authenticated: authenticated === 'true'
      })
    }
  }, [searchParams])

  const handleDownload = () => {
    if (!results?.detailedResults) return;

    const blob = new Blob([results.detailedResults], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Helper function to check if it's a local comparison
  const isLocalComparison = (results: ComparisonResults) => {
    return results.directoryV1.startsWith('local/') || results.directoryV2.startsWith('local/');
  };

  if (!results) {
    return (
      <div className="flex justify-center pt-8">
        <Card className="w-full max-w-md">
          <CardContent className="py-6">
            <div className="text-center">
              <p className="text-muted-foreground">Loading results...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLocal = isLocalComparison(results);

  return (
    <div className="flex justify-center pt-8">
      <Card className="w-full max-w-md">
        <CardContent className="py-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Submission Complete!</h2>
            <p className="text-muted-foreground">Your comparison results have been saved successfully.</p>
          </div>

          {results.authenticated === false && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-medium text-yellow-800">Sign in to save your results</p>
              <p className="mt-2 text-sm text-yellow-700">
                Your comparison results are only available temporarily. Sign in to save your history and contribute to global ratings.
              </p>
              <Button 
                variant="outline" 
                className="mt-3 w-full"
                onClick={() => router.push('/auth/signin')}
              >
                Sign In
              </Button>
            </div>
          )}

          <div className="rounded-lg border">
            <div className="flex justify-between items-center p-3 bg-muted/50 border-b">
              <span className="font-medium">Final Scores</span>
              <Badge variant="outline">{results.totalComparisons} comparisons</Badge>
            </div>
            <div className="divide-y">
              {[
                { name: results.directoryNameV1 || results.directoryV1, path: results.directoryV1, score: results.scoreV1 },
                { name: results.directoryNameV2 || results.directoryV2, path: results.directoryV2, score: results.scoreV2 }
              ]
                .sort((a, b) => b.score - a.score)
                .map((result, index) => (
                  <div key={index} className="flex justify-between items-center p-3">
                    <span>{result.name.replace('local/', '')}</span>
                    <span className="font-medium">{result.score.toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="flex gap-3">
            <Link href={isLocal ? "/dashboard/comparisons" : "/dashboard/ratings"} className="flex-1">
              <Button variant="default" className="w-full gap-2">
                {isLocal ? (
                  <>
                    <History className="h-4 w-4" />
                    View History
                  </>
                ) : (
                  "View Live Ratings"
                )}
              </Button>
            </Link>
            <Button 
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 