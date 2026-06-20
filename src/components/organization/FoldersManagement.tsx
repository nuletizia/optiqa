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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, FolderIcon, Pencil } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface Folder {
  path: string;
  imageCount: number;
  totalRatings: number;
  averageRating: number;
  totalUsers: number;
  product: string;
  version: string;
}

interface DirectoryData {
  directoryPath: string;
  totalRatings: number;
  averageRating: number;
  totalUsers: number;
}

interface ProductVersion {
  [version: string]: DirectoryData[];
}

interface ProductData {
  product: string;
  versions: ProductVersion;
}

interface RatingsResponse {
  products: ProductData[];
}

interface RatingData {
  directoryPath: string;
  rating: number;
  comparisons: number;
  lastUpdated: Date;
  userId: string;
}

interface WeightedRating {
  totalWeightedRating: number;
  totalWeight: number;
  totalComparisons: number;
  lastUpdated: Date;
  uniqueUsers: Set<string>;
}

interface RenameStatus {
  status: 'started' | 'in_progress' | 'completed' | 'error';
  progress: number;
  processedObjects?: number;
  totalObjects?: number;
  error?: string;
  oldPath?: string;
  newPath?: string;
  startTime?: number;
  endTime?: number;
}

interface Props {
  organizationId: string
}

interface DirectoryEntry {
  name: string;
  path: string;
  imageCount: number;
  product: string;
}

const fetchDirectories = async (): Promise<DirectoryEntry[]> => {
  try {
    const res = await fetch('/api/organization/directories');
    const data = await res.json();

    if (!data.success || !Array.isArray(data.directories)) {
      return [];
    }

    return (data.directories as DirectoryEntry[]).filter(dir => dir.imageCount > 0);
  } catch (error) {
    console.error('Error fetching directories:', error);
    return [];
  }
};

export function FoldersManagement({ organizationId }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string | 'all'>('all')
  const [renameOperation, setRenameOperation] = useState<{
    operationId: string;
    status: RenameStatus;
  } | null>(null);

  // Define loadFolders as a function in the component scope
  const loadFolders = async () => {
    setLoading(true)
    try {
      // Fetch all directories from the server (active org resolved server-side)
      const s3Directories = await fetchDirectories();

      // Get ratings for these directories
      const ratingsResponse = await fetch('/api/organization/ratings/directories');
      if (!ratingsResponse.ok) throw new Error('Failed to load ratings');
      const ratingsData = (await ratingsResponse.json()) as RatingsResponse;
      
      // Create a map of directory paths to their ratings data
      type RatingInfo = {
        totalRatings: number;
        averageRating: number;
        totalUsers: number;
        product: string;
        version: string;
      };

      const directoryRatingsMap = new Map<string, RatingInfo>(
        ratingsData.products.flatMap(product =>
          Object.entries(product.versions).flatMap(([version, directories]) =>
            directories.map(dir => [
              dir.directoryPath,
              {
                totalRatings: dir.totalRatings,
                averageRating: dir.averageRating,
                totalUsers: dir.totalUsers,
                product: product.product,
                version
              }
            ])
          )
        )
      );
      
      // Combine directory info with ratings
      const combinedFolders = s3Directories.map(dir => {
        const ratings = directoryRatingsMap.get(dir.path) || {
          totalRatings: 0,
          averageRating: 0,
          totalUsers: 0,
          product: extractProductFromPath(dir.path),
          version: extractVersionFromPath(dir.path)
        };

        return {
          path: dir.path,
          totalRatings: ratings.totalRatings,
          averageRating: ratings.averageRating,
          totalUsers: ratings.totalUsers,
          imageCount: dir.imageCount,
          product: ratings.product,
          version: ratings.version
        };
      });
      
      setFolders(combinedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  // Load folders on mount and when successMessage changes
  useEffect(() => {
    loadFolders()
  }, [successMessage])

  // Add polling for rename status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollRenameStatus = async () => {
      if (!renameOperation?.operationId) return;

      try {
        const response = await fetch(`/api/organization/folders/rename?operationId=${renameOperation.operationId}`);
        if (!response.ok) throw new Error('Failed to fetch rename status');
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        setRenameOperation(prev => ({
          ...prev!,
          status: data.status
        }));

        // Stop polling if operation is complete or errored
        if (data.status.status === 'completed' || data.status.status === 'error') {
          clearInterval(pollInterval);
          // Refresh folder list after completion
          if (data.status.status === 'completed') {
            setSuccessMessage('Folder renamed successfully');
            loadFolders(); // Your existing function to reload folders
          } else {
            setError(data.status.error || 'Failed to rename folder');
          }
          setRenameOperation(null);
        }
      } catch (err) {
        console.error('Error polling rename status:', err);
        clearInterval(pollInterval);
        setError(err instanceof Error ? err.message : 'Failed to check rename status');
        setRenameOperation(null);
      }
    };

    if (renameOperation?.operationId) {
      // Poll every 2 seconds
      pollInterval = setInterval(pollRenameStatus, 2000);
      // Initial poll
      pollRenameStatus();
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [renameOperation?.operationId]);

  const handleRename = async () => {
    if (!selectedFolder || !newFolderName.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/organization/folders/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPath: selectedFolder.path.replace(/\/$/, ''),
          newName: newFolderName.trim()
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to rename folder');
      }

      // Set initial rename operation state
      setRenameOperation({
        operationId: data.operationId,
        status: {
          status: 'started',
          progress: 0
        }
      });

      setShowRenameDialog(false);
      setSelectedFolder(null);
      setNewFolderName('');
    } catch (err) {
      console.error('Error in handleRename:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    } finally {
      setLoading(false);
    }
  };

  const openRenameDialog = (folder: Folder) => {
    setSelectedFolder(folder)
    // Extract just the folder name from the path
    const currentName = folder.path.split('/').pop()?.replace('/', '') || ''
    setNewFolderName(currentName)
    setShowRenameDialog(true)
  }

  // Get unique products from folders
  const products = Array.from(new Set(folders.map(folder => folder.product))).filter(Boolean);

  // Filter folders by selected product
  const filteredFolders = selectedProduct === 'all' 
    ? folders 
    : folders.filter(folder => folder.product === selectedProduct);

  // Update the rename dialog content to show progress
  const getRenameDialogContent = () => {
    if (renameOperation) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Renaming Folder</h3>
            <Progress value={renameOperation.status.progress} />
            <p className="text-sm text-muted-foreground">
              {renameOperation.status.processedObjects ?? 0} of {renameOperation.status.totalObjects ?? '?'} files processed
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label>Current path</Label>
          <div className="text-sm font-mono bg-muted p-2 rounded">
            <span className="text-muted-foreground">{selectedFolder?.path}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="newName">New folder name</Label>
          <Input
            id="newName"
            value={newFolderName}
            onChange={(e) => {
              // Remove any slashes from input
              setNewFolderName(e.target.value.replace(/\//g, ''))
            }}
            placeholder="Enter new folder name (without slashes)"
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">
            The folder will be renamed to: {selectedFolder?.path.replace(/[^/]+\/?$/, '')}{newFolderName}/
          </p>
        </div>
      </div>
    );
  };

  if (loading && folders.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add loading bar when rename operation is in progress */}
      {renameOperation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Renaming folder in progress...</span>
            <span>{Math.round(renameOperation.status.progress)}%</span>
          </div>
          <Progress value={renameOperation.status.progress} className="w-full" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Organization Folders</h3>
          <p className="text-sm text-gray-500">
            Manage your organization's folders and their ratings
          </p>
        </div>
        {selectedProduct !== 'all' && (
          <Badge variant="secondary" className="text-xs">
            Filtering by: {selectedProduct}
          </Badge>
        )}
      </div>

      <Select
        value={selectedProduct}
        onValueChange={(value) => setSelectedProduct(value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Filter by product..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Products</SelectItem>
          {products.map(product => (
            <SelectItem key={product} value={product}>
              {product}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && folders.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFolders.map((folder) => (
            <div
              key={folder.path}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-start space-x-4">
                <FolderIcon className="h-6 w-6 text-blue-500" />
                <div>
                  <div className="font-medium">{folder.path.split('/').pop()}</div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Product: {folder.product} • Version: {folder.version}</p>
                    <p>{folder.imageCount} images • {folder.totalRatings} ratings • {folder.totalUsers} users</p>
                    {folder.averageRating > 0 && (
                      <p>Average Rating: {folder.averageRating.toFixed(1)}</p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openRenameDialog(folder)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

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

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              {renameOperation 
                ? "Renaming in progress. This may take a few minutes for folders with many files."
                : "Enter the new folder name only (not the full path). This will rename the folder in S3 and update all associated ratings."}
            </DialogDescription>
          </DialogHeader>
          {getRenameDialogContent()}
          {!renameOperation && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={loading || !newFolderName.trim() || newFolderName === selectedFolder?.path.split('/').pop()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Rename...
                  </>
                ) : (
                  'Rename Folder'
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper functions to extract product and version from path
function extractProductFromPath(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts[1] : 'unknown';
}

function extractVersionFromPath(path: string): string {
  const parts = path.split('/');
  return parts.length > 2 ? parts[2] : 'unknown';
} 