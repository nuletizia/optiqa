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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash2, Edit } from 'lucide-react'

interface ComparisonSet {
  id: string
  name: string
  description: string | null
  directoryV1: string
  directoryV2: string
  createdAt: string
  createdBy: {
    name: string | null
    email: string
  }
}

interface Folder {
  path: string
  imageCount: number
  totalRatings: number
  averageRating: number
  totalUsers: number
  product: string
  version: string
}

interface ProductVersion {
  directoryPath: string
  totalRatings: number
  averageRating: number
  totalUsers: number
}

interface ProductData {
  product: string
  versions: Record<string, ProductVersion[]>
}

interface RatingsResponse {
  products: Array<{
    product: string;
    versions: Record<string, Array<{
      directoryPath: string;
      totalRatings: number;
      averageRating: number;
      totalUsers: number;
    }>>;
  }>;
}

interface Props {
  organizationId: string
}

export function ComparisonSetsManagement({ organizationId }: Props) {
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparisonSets, setComparisonSets] = useState<ComparisonSet[]>([])
  const [editingSet, setEditingSet] = useState<ComparisonSet | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string | 'all'>('all')
  const [newSet, setNewSet] = useState({
    name: '',
    description: '',
    directoryV1: '',
    directoryV2: ''
  })

  // Get unique products from folders
  const products = Array.from(new Set(folders.map(folder => folder.product))).filter(Boolean)

  // Filter folders by selected product
  const filteredFolders = selectedProduct === 'all' 
    ? folders 
    : folders.filter(folder => folder.product === selectedProduct)

  // Fetch comparison sets
  const fetchComparisonSets = async () => {
    try {
      const response = await fetch('/api/organization/comparison-sets')
      if (!response.ok) throw new Error('Failed to fetch comparison sets')
      const data = await response.json()
      setComparisonSets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comparison sets')
    }
  }

  // Fetch directories for the active organization from the server endpoint
  const fetchDirectories = async () => {
    try {
      const res = await fetch('/api/organization/directories');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error('Failed to fetch directories');
      }

      return (data.directories as Array<{
        name: string;
        path: string;
        imageCount: number;
        product: string;
      }>).map(dir => ({
        path: dir.path,
        imageCount: dir.imageCount,
        totalRatings: 0,
        averageRating: 0,
        totalUsers: 0,
        product: dir.product,
        version: dir.name
      }));
    } catch (error) {
      console.error('Error fetching directories:', error);
      return [];
    }
  };

  // Fetch folders
  const loadFolders = async () => {
    setLoading(true)
    try {
      // Fetch all version directories for the active organization
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
          product: dir.product,
          version: dir.version
        };

        return {
          path: dir.path,
          totalRatings: ratings.totalRatings,
          averageRating: ratings.averageRating,
          totalUsers: ratings.totalUsers,
          imageCount: dir.imageCount,
          product: ratings.product || dir.product,
          version: ratings.version || dir.version
        };
      });
      
      setFolders(combinedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComparisonSets()
    loadFolders()
  }, [])

  const handleResetComparisonSets = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/organization/comparison-sets/reset', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to reset comparison sets')
      setShowResetDialog(false)
      await fetchComparisonSets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset comparison sets')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSet = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/organization/comparison-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSet)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create comparison set')
      }
      setShowCreateDialog(false)
      setNewSet({
        name: '',
        description: '',
        directoryV1: '',
        directoryV2: ''
      })
      await fetchComparisonSets()
    } catch (err) {
      console.error('Error creating comparison set:', err)
      setError(err instanceof Error ? err.message : 'Failed to create comparison set')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSet = async (id: string) => {
    try {
      const response = await fetch(`/api/organization/comparison-sets?id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete comparison set')
      await fetchComparisonSets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comparison set')
    }
  }

  const handleEditSet = async () => {
    if (!editingSet) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/organization/comparison-sets/${editingSet.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingSet.name,
          description: editingSet.description
        })
      });
      if (!response.ok) {
        throw new Error('Failed to update comparison set');
      }
      setShowEditDialog(false);
      setEditingSet(null);
      await fetchComparisonSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comparison set');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Comparison Sets</h2>
          <p className="text-sm text-gray-500">
            Create and manage preset comparison sets for your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Set
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowResetDialog(true)}
            disabled={loading}
          >
            Reset All Sets
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {comparisonSets.map((set) => (
          <Card key={set.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">{set.name}</CardTitle>
                <CardDescription>
                  Created by {set.createdBy.name || set.createdBy.email} on {new Date(set.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingSet(set);
                    setShowEditDialog(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteSet(set.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {set.description && (
                  <p className="text-sm text-gray-500">{set.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Directory 1</Label>
                    <p className="text-sm font-mono">{set.directoryV1}</p>
                  </div>
                  <div>
                    <Label>Directory 2</Label>
                    <p className="text-sm font-mono">{set.directoryV2}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Comparison Sets</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all comparison sets for your organization.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetComparisonSets}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset Sets
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Comparison Set</DialogTitle>
            <DialogDescription>
              Create a new preset comparison set for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newSet.name}
                onChange={(e) => setNewSet(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Hair Model Comparison"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newSet.description}
                onChange={(e) => setNewSet(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose of this comparison set..."
              />
            </div>
            <div>
              <Label htmlFor="product">Product</Label>
              <Select
                value={selectedProduct}
                onValueChange={setSelectedProduct}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
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
            </div>
            <div>
              <Label htmlFor="directoryV1">Directory 1</Label>
              <Select
                value={newSet.directoryV1}
                onValueChange={(value) => setNewSet(prev => ({ ...prev, directoryV1: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select first directory" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredFolders.map((folder) => (
                    <SelectItem key={folder.path} value={folder.path}>
                      <div className="flex flex-col">
                        <span className="font-medium">{folder.version}</span>
                        <span className="text-xs text-muted-foreground font-mono">{folder.path} ({folder.imageCount} images)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="directoryV2">Directory 2</Label>
              <Select
                value={newSet.directoryV2}
                onValueChange={(value) => setNewSet(prev => ({ ...prev, directoryV2: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select second directory" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredFolders
                    .filter(folder => folder.path !== newSet.directoryV1)
                    .map((folder) => (
                      <SelectItem key={folder.path} value={folder.path}>
                        <div className="flex flex-col">
                          <span className="font-medium">{folder.version}</span>
                          <span className="text-xs text-muted-foreground font-mono">{folder.path} ({folder.imageCount} images)</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSet} 
              disabled={loading || !newSet.name || !newSet.directoryV1 || !newSet.directoryV2}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Comparison Set</DialogTitle>
            <DialogDescription>
              Update the name and description of this comparison set
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editingSet?.name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setEditingSet(prev => prev ? { ...prev, name: e.target.value } : null)
                }
                placeholder="e.g., Hair Model Comparison"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={editingSet?.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                  setEditingSet(prev => prev ? { ...prev, description: e.target.value } : null)
                }
                placeholder="Describe the purpose of this comparison set..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setEditingSet(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditSet} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 