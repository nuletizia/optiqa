"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from 'react'
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface Rating {
  directoryPath: string
  rating: number
  comparisons: number
  lastUpdated: string
  confidence?: number
  totalUsers?: number
  totalRatings?: number
  product: string
  version: string
  displayName?: string
}

interface ProductRating {
  product: string
  versions: Record<string, Array<{
    directoryPath: string
    totalRatings: number
    averageRating: number
    totalUsers: number
    lastUpdated: string
    displayName?: string
  }>>
}

interface ComparisonSetRating {
  id: string
  name: string
  ratings: Rating[]
}

interface ComparisonSets {
  personal: ComparisonSetRating[]
  aggregated: ComparisonSetRating[]
}

// Add a utility function for consistent date formatting
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
}

function RatingsList({ ratings, title }: { ratings: Rating[], title: string }) {
  const [selectedProduct, setSelectedProduct] = useState<string | 'all'>('all')

  // Get unique products from ratings
  const products = Array.from(new Set(ratings.map(r => r.product))).filter(Boolean)

  // Filter ratings by selected product
  const filteredRatings = selectedProduct === 'all' 
    ? ratings 
    : ratings.filter(r => r.product === selectedProduct)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Select
          value={selectedProduct}
          onValueChange={(value) => setSelectedProduct(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((product) => (
              <SelectItem key={product} value={product}>
                {product}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRatings.length === 0 ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">No Ratings Available</p>
          <p className="mt-2 text-sm text-yellow-700">
            Complete some image comparisons to see ratings appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRatings
            .sort((a, b) => b.rating - a.rating)
            .map(({ directoryPath, rating, comparisons, lastUpdated, confidence, totalUsers, product, version }) => (
              <Card key={`${product}:${directoryPath}`} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="break-all">
                      <p className="text-sm font-medium text-primary">{directoryPath.split('/').filter(Boolean).pop()}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{directoryPath}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{product}</Badge>
                      </div>
                      <p className="text-3xl font-bold mt-2">{Math.round(rating)}</p>
                    </div>
                    <div className="bg-primary/10 px-3 py-1 rounded-full">
                      <p className="text-sm font-medium text-primary">
                        #{filteredRatings.findIndex(r => r.product === product && r.directoryPath === directoryPath) + 1}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    <p>Total Comparisons: {comparisons}</p>
                    {totalUsers !== undefined && (
                      <p>Total Users: {totalUsers}</p>
                    )}
                    {confidence !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>Confidence:</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, confidence)}%`
                            }} 
                          />
                        </div>
                      </div>
                    )}
                    <p>Last Updated: {formatDate(lastUpdated)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

function ProductRatingsList({ products }: { products: ProductRating[] }) {
  const [selectedProduct, setSelectedProduct] = useState<string | 'all'>('all')

  // Flatten the products data structure to match personal ratings format
  const flattenedRatings = products.flatMap(product =>
    Object.entries(product.versions).flatMap(([version, ratings]) =>
      ratings.map(rating => ({
        directoryPath: rating.directoryPath,
        rating: rating.averageRating,
        comparisons: rating.totalRatings,
        lastUpdated: rating.lastUpdated,
        totalUsers: rating.totalUsers,
        product: product.product,
        version: version,
        displayName: rating.displayName,
        // Calculate confidence based on users and comparisons
        confidence: Math.min(100, (rating.totalUsers * rating.totalRatings) / 10)
      }))
    )
  )

  // Filter ratings by selected product
  const filteredRatings = selectedProduct === 'all'
    ? flattenedRatings
    : flattenedRatings.filter(r => r.product === selectedProduct)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Organization Ratings</h3>
        <Select
          value={selectedProduct}
          onValueChange={(value) => setSelectedProduct(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products
              .filter(p => p.product && p.product.trim() !== '')
              .map((p) => (
                <SelectItem key={p.product} value={p.product}>
                  {p.product}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRatings.length === 0 ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">No Ratings Available</p>
          <p className="mt-2 text-sm text-yellow-700">
            Complete some image comparisons to see ratings appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRatings
            .sort((a, b) => b.rating - a.rating)
            .map(({ directoryPath, rating, comparisons, lastUpdated, totalUsers, product, version }) => (
              <Card key={`${product}:${directoryPath}`} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="break-all">
                      <p className="text-sm font-medium text-primary">{directoryPath.split('/').filter(Boolean).pop()}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{directoryPath}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{product}</Badge>
                      </div>
                      <p className="text-3xl font-bold mt-2">{Math.round(rating)}</p>
                    </div>
                    <div className="bg-primary/10 px-3 py-1 rounded-full">
                      <p className="text-sm font-medium text-primary">
                        #{filteredRatings.findIndex(r => r.product === product && r.directoryPath === directoryPath) + 1}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    <p>Total Comparisons: {comparisons}</p>
                    <p>Total Users: {totalUsers}</p>
                    <div className="flex items-center gap-2">
                      <span>Confidence:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ 
                            width: `${Math.min(100, (totalUsers * comparisons) / 10)}%`
                          }} 
                        />
                      </div>
                    </div>
                    <p>Last Updated: {formatDate(lastUpdated)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

function ComparisonSetRatingsList({ comparisonSets }: { comparisonSets: ComparisonSets }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'personal'>('all');

  // Get current sets based on view mode
  const currentSets = viewMode === 'personal' ? comparisonSets.personal : comparisonSets.aggregated;

  // Get unique products from all ratings
  const products = Array.from(new Set(
    currentSets.flatMap(set => 
      set.ratings.map(r => r.product)
    )
  )).sort();

  // Get all ratings from all sets
  const allRatings = currentSets.flatMap(set => 
    set.ratings.map(rating => ({
      ...rating,
      setName: set.name,
      setId: set.id
    }))
  );

  // Filter ratings based on selected product and set
  const filteredRatings = allRatings.filter(r => {
    const matchesProduct = !selectedProduct || r.product === selectedProduct;
    const matchesSet = selectedSet === 'all' || r.setId === selectedSet;
    return matchesProduct && matchesSet;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Comparison Sets</h3>
        <div className="flex items-center gap-4">
          <Select
            value={selectedProduct || "all"}
            onValueChange={(value) => setSelectedProduct(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map(product => (
                <SelectItem key={product} value={product}>{product}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedSet}
            onValueChange={(value) => setSelectedSet(value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All sets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sets</SelectItem>
              {currentSets.map(set => (
                <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={viewMode}
            onValueChange={(value: 'all' | 'personal') => {
              setViewMode(value);
              setSelectedSet('all'); // Reset set selection when changing view mode
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select view mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="personal">My Ratings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredRatings.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          No comparison sets available
          {selectedProduct && " for the selected product"}
          {selectedSet !== 'all' && " in the selected set"}
          {viewMode === 'personal' && " in your personal ratings"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRatings
            .sort((a, b) => b.rating - a.rating)
            .map((rating, index) => (
              <Card key={`${rating.setId}:${rating.directoryPath}`} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="break-all">
                      <p className="text-sm font-medium text-primary">{rating.directoryPath.split('/').filter(Boolean).pop()}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{rating.directoryPath}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{rating.product}</Badge>
                        <Badge variant="outline">{rating.setName}</Badge>
                      </div>
                      <p className="text-3xl font-bold mt-2">{Math.round(rating.rating)}</p>
                    </div>
                    <div className="bg-primary/10 px-3 py-1 rounded-full">
                      <p className="text-sm font-medium text-primary">
                        #{index + 1}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    {viewMode === 'all' ? (
                      <>
                        <p>Total Comparisons: {rating.totalRatings || rating.comparisons}</p>
                        {rating.totalUsers !== undefined && (
                          <p>Total Users: {rating.totalUsers}</p>
                        )}
                        {rating.totalUsers !== undefined && rating.totalRatings !== undefined && (
                          <div className="flex items-center gap-2">
                            <span>Confidence:</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ 
                                  width: `${Math.min(100, (rating.totalUsers * rating.totalRatings) / 10)}%`
                                }} 
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p>Total Comparisons: {rating.comparisons}</p>
                    )}
                    <p>Last Updated: {formatDate(rating.lastUpdated)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

export interface RatingsDisplayProps {
  personalRatings: Rating[]
  organizationRatings: ProductRating[]
  comparisonSets: ComparisonSets
}

export function RatingsDisplay({ personalRatings, organizationRatings, comparisonSets }: RatingsDisplayProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'global' | 'personal'>('global');

  return (
    <Tabs defaultValue="ratings" className="space-y-4">
      <TabsList>
        <TabsTrigger value="ratings">Ratings</TabsTrigger>
        <TabsTrigger value="sets">Comparison Sets</TabsTrigger>
      </TabsList>

      <TabsContent value="ratings">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Organization Ratings</h3>
            <div className="flex items-center gap-4">
              <Select
                value={selectedProduct}
                onValueChange={(value) => setSelectedProduct(value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {organizationRatings
                    .filter(p => p.product && p.product.trim() !== '')
                    .map((p) => (
                      <SelectItem key={p.product} value={p.product}>
                        {p.product}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={viewMode}
                onValueChange={(value: 'global' | 'personal') => setViewMode(value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="View mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">All Users</SelectItem>
                  <SelectItem value="personal">My Ratings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {viewMode === 'global' ? (
            // Organization-wide ratings display
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizationRatings
                .filter(p => selectedProduct === 'all' || p.product === selectedProduct)
                .flatMap(product => {
                  // First, flatten all ratings for this product
                  const allRatings = Object.entries(product.versions).flatMap(([version, ratings]) =>
                    ratings.map(rating => ({
                      ...rating,
                      product: product.product,
                      version
                    }))
                  );
                  
                  // Then sort all ratings by averageRating
                  return allRatings
                    .sort((a, b) => b.averageRating - a.averageRating)
                    .map((rating, index) => (
                      <Card key={`${product.product}:${rating.directoryPath}`} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="break-all">
                              <p className="text-sm font-medium text-primary">{rating.directoryPath.split('/').filter(Boolean).pop()}</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">{rating.directoryPath}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">{product.product}</Badge>
                              </div>
                              <p className="text-3xl font-bold mt-2">{Math.round(rating.averageRating)}</p>
                            </div>
                            <div className="bg-primary/10 px-3 py-1 rounded-full">
                              <p className="text-sm font-medium text-primary">
                                #{index + 1}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-muted-foreground space-y-1">
                            <p>Total Comparisons: {rating.totalRatings}</p>
                            <p>Total Users: {rating.totalUsers}</p>
                            <div className="flex items-center gap-2">
                              <span>Confidence:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full" 
                                  style={{ width: `${Math.min(100, (rating.totalUsers * rating.totalRatings) / 10)}%` }} 
                                />
                              </div>
                            </div>
                            <p>Last Updated: {formatDate(rating.lastUpdated)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ));
                })}
            </div>
          ) : (
            // Personal ratings display
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personalRatings
                .filter(rating => selectedProduct === 'all' || rating.product === selectedProduct)
                .sort((a, b) => b.rating - a.rating)
                .map((rating, index) => (
                  <Card key={`personal:${rating.directoryPath}`} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="break-all">
                          <p className="text-sm font-medium text-primary">{rating.directoryPath.split('/').filter(Boolean).pop()}</p>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{rating.directoryPath}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{rating.product}</Badge>
                            <Badge variant="outline">Personal</Badge>
                          </div>
                          <p className="text-3xl font-bold mt-2">{Math.round(rating.rating)}</p>
                        </div>
                        <div className="bg-primary/10 px-3 py-1 rounded-full">
                          <p className="text-sm font-medium text-primary">
                            #{index + 1}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-muted-foreground space-y-1">
                        <p>Your Comparisons: {rating.comparisons}</p>
                        <p>Last Updated: {formatDate(rating.lastUpdated)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="sets">
        <ComparisonSetRatingsList comparisonSets={comparisonSets} />
      </TabsContent>
    </Tabs>
  );
} 