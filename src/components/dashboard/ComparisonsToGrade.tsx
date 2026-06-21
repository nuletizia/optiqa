"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, ArrowRight, Scale } from 'lucide-react'

interface ComparisonSet {
  id: string
  name: string
  description: string | null
  directoryV1: string
  directoryV2: string
  batchALabel?: string | null
  batchBLabel?: string | null
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

const lastSegment = (path: string) => path.split('/').filter(Boolean).pop() || ''
const batchName = (label: string | null | undefined, path: string) =>
  label && label.trim() ? label : lastSegment(path)

export function ComparisonsToGrade() {
  const [sets, setSets] = useState<ComparisonSet[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [setsRes, progressRes] = await Promise.all([
          fetch('/api/organization/comparison-sets'),
          fetch('/api/organization/comparison-sets/progress'),
        ])
        if (!setsRes.ok) throw new Error('Failed to load comparisons')
        const setsData = await setsRes.json()
        const progressData = progressRes.ok ? await progressRes.json() : { progress: {} }
        if (cancelled) return
        setSets(Array.isArray(setsData) ? setsData : [])
        setProgress(progressData.progress ?? {})
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load comparisons')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Comparisons to grade</h2>
        <Link href="/dashboard/new-comparison">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Create a comparison
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : sets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Scale className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No comparisons yet. Create one to let your team start grading.
            </p>
            <Link href="/dashboard/new-comparison">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> Create a comparison
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map(set => {
            const graded = progress[set.id] ?? 0
            return (
              <Card key={set.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{set.name}</CardTitle>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary">{batchName(set.batchALabel, set.directoryV1)}</Badge>
                    <span>vs</span>
                    <Badge variant="secondary">{batchName(set.batchBLabel, set.directoryV2)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 justify-between gap-3">
                  <div className="space-y-1">
                    {set.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{set.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {graded > 0 ? `You've graded ${graded} comparison${graded === 1 ? '' : 's'}` : 'Not started yet'}
                    </p>
                  </div>
                  <Link href={`/comparison?set=${set.id}`} className="w-full">
                    <Button className="w-full" size="sm">
                      {graded > 0 ? 'Keep grading' : 'Grade'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
