"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface Directory {
  directoryPath: string;
  product: string;
  version: string;
  totalRatings: number;
  averageRating: number;
}

interface DirectoryData {
  directoryPath: string;
  totalRatings: number;
  averageRating: number;
}

interface ProductVersion {
  [version: string]: DirectoryData[];
}

interface ProductData {
  product: string;
  versions: ProductVersion;
}

interface Props {
  organizationId: string
}

export function RatingsManagement({ organizationId }: Props) {
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDirectoryResetDialog, setShowDirectoryResetDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDirectories, setLoadingDirectories] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [directories, setDirectories] = useState<Directory[]>([])
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>([])

  // Load directories with ratings
  useEffect(() => {
    const fetchDirectories = async () => {
      setLoadingDirectories(true)
      try {
        const response = await fetch('/api/organization/ratings/directories')
        if (!response.ok) throw new Error('Failed to load directories')
        const data = await response.json()
        
        // Transform the data to match our component's needs
        const flattenedDirectories: Directory[] = (data.products as ProductData[]).flatMap(product => 
          Object.entries(product.versions).flatMap(([version, directories]) =>
            directories.map(dir => ({
              directoryPath: dir.directoryPath,
              product: product.product,
              version,
              totalRatings: dir.totalRatings,
              averageRating: dir.averageRating
            }))
          )
        )
        
        setDirectories(flattenedDirectories)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load directories')
      } finally {
        setLoadingDirectories(false)
      }
    }
    fetchDirectories()
  }, [successMessage]) // Reload after successful reset

  const handleResetRatings = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/organization/ratings/reset', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to reset ratings')
      const data = await response.json()
      setShowResetDialog(false)
      setSuccessMessage(data.message || 'Ratings have been reset successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset ratings')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSelectedDirectories = async () => {
    if (selectedDirectories.length === 0) {
      setError('Please select at least one directory to reset')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/organization/ratings/reset-directories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directories: selectedDirectories }),
      })
      if (!response.ok) throw new Error('Failed to reset directory ratings')
      const data = await response.json()
      setShowDirectoryResetDialog(false)
      setSelectedDirectories([])
      setSuccessMessage(data.message || 'Directory ratings have been reset successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset directory ratings')
    } finally {
      setLoading(false)
    }
  }

  const toggleDirectory = (directoryPath: string) => {
    setSelectedDirectories(prev => 
      prev.includes(directoryPath)
        ? prev.filter(d => d !== directoryPath)
        : [...prev, directoryPath]
    )
  }

  return (
    <div className="space-y-4">
      {/* Reset All Ratings */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <h3 className="font-medium">Reset All Organization Ratings</h3>
          <p className="text-sm text-gray-500">
            This will permanently delete all ratings data for your organization.
            This action cannot be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowResetDialog(true)}
          disabled={loading}
        >
          Reset All Ratings
        </Button>
      </div>

      {/* Reset Directory Ratings */}
      <div className="p-4 border rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Reset Directory Ratings</h3>
            <p className="text-sm text-gray-500">
              Select specific directories to reset their ratings.
              This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDirectoryResetDialog(true)}
            disabled={loading || loadingDirectories || directories.length === 0}
          >
            Reset Selected
          </Button>
        </div>

        {loadingDirectories ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : directories.length > 0 ? (
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <div className="space-y-4">
              {directories.map((dir) => (
                <div key={`${dir.product}:${dir.directoryPath}`} className="flex items-start space-x-3">
                  <Checkbox
                    id={`${dir.product}:${dir.directoryPath}`}
                    checked={selectedDirectories.includes(dir.directoryPath)}
                    onCheckedChange={() => toggleDirectory(dir.directoryPath)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={`${dir.product}:${dir.directoryPath}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {dir.directoryPath}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Product: {dir.product} • {dir.totalRatings} ratings • Average: {dir.averageRating.toFixed(1)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No directories with ratings found
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 text-sm text-green-700 bg-green-50 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Reset All Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Organization Ratings</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all ratings data for your organization.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetRatings}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset All Ratings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Directories Dialog */}
      <AlertDialog open={showDirectoryResetDialog} onOpenChange={setShowDirectoryResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Selected Directory Ratings</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ratings data for {selectedDirectories.length} selected {selectedDirectories.length === 1 ? 'directory' : 'directories'}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetSelectedDirectories}
              className="bg-red-600 hover:bg-red-700"
              disabled={selectedDirectories.length === 0}
            >
              Reset Selected Ratings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 