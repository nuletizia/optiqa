import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DirectoryState, ImageFile } from './types';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface PresetDirectorySetupProps {
  imageFiles: DirectoryState;
  directoryNames: { v1: string; v2: string };
  onDirectorySelect: (version: 'v1' | 'v2', files: ImageFile[], directoryPath: string) => void;
  onNameUpdate: (version: 'v1' | 'v2', name: string) => void;
  onStart: () => void;
  isReadyToStart: boolean;
  onComparisonSetSelect?: (setId: string | null) => void;
  autoSelectSetId?: string;
}

interface PresetDirectory {
  name: string;
  path: string;
  count: number;
  product: string;
}

interface ComparisonSet {
  id: string;
  name: string;
  description: string | null;
  directoryV1: string;
  directoryV2: string;
  batchALabel?: string | null;
  batchBLabel?: string | null;
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string;
  };
}

const formatOrganizationPath = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const fetchDirectories = async (): Promise<PresetDirectory[]> => {
  try {
    const response = await fetch('/api/organization/directories');
    if (!response.ok) {
      throw new Error('Failed to fetch directories');
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.directories)) {
      return [];
    }

    return data.directories
      .map((dir: { name: string; path: string; imageCount: number; product: string }) => ({
        name: dir.name,
        path: dir.path,
        count: dir.imageCount,
        product: dir.product
      }))
      .filter((dir: PresetDirectory) => dir.count > 0);
  } catch (error) {
    console.error('Error fetching directories:', error);
    return [];
  }
};

export const PresetDirectorySetup = ({
  onDirectorySelect,
  onNameUpdate,
  imageFiles,
  directoryNames,
  onStart,
  isReadyToStart,
  onComparisonSetSelect,
  autoSelectSetId
}: PresetDirectorySetupProps) => {
  const [directories, setDirectories] = useState<PresetDirectory[]>([]);
  const [comparisonSets, setComparisonSets] = useState<ComparisonSet[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrg, setCurrentOrg] = useState<{organizationName: string} | null>(null);
  const [selectedDirectories, setSelectedDirectories] = useState<{
    v1: string | null;
    v2: string | null;
  }>({ v1: null, v2: null });
  const [selectedTab, setSelectedTab] = useState<string>("comparison-sets");

  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    const loadDirectories = async () => {
      if (status === 'loading') return;
      if (!session?.user) return;

      setLoading(true);
      try {
        // Get user's memberships and current organization
        const userMemberships = await fetch('/api/user/memberships').then(res => res.json());
        const org = userMemberships.find((m: any) => m.isCurrentSession);
        
        if (!org) {
          setError('No active organization found');
          return;
        }

        if (!org.isApprovedMember) {
          setError('Your organization membership is pending approval. Please wait for an admin to activate your account.');
          return;
        }

        const organizationPath = formatOrganizationPath(org.organizationName);
        setCurrentOrg({ organizationName: organizationPath });
        const dirs = await fetchDirectories();
        setDirectories(dirs);
        setError(null);
      } catch (err) {
        console.error('Error loading directories:', err);
        setError(`Failed to load directories: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadDirectories();
  }, [session, status]);

  useEffect(() => {
    const loadComparisonSets = async () => {
      if (!session?.user) return;

      try {
        const response = await fetch('/api/organization/comparison-sets');
        if (!response.ok) {
          throw new Error('Failed to fetch comparison sets');
        }
        const data = await response.json();
        setComparisonSets(data);
      } catch (err) {
        console.error('Error loading comparison sets:', err);
      }
    };

    loadComparisonSets();
  }, [session]);

  const handleDirectorySelect = async (version: 'v1' | 'v2', directory: PresetDirectory) => {
    // Check if we're trying to select the same folder with same product in production
    if (process.env.NODE_ENV === 'production') {
      const otherVersion = version === 'v1' ? 'v2' : 'v1';
      const otherDirectory = selectedDirectories[otherVersion];
      
      if (otherDirectory === directory.path && directory.product === directories.find(d => d.path === otherDirectory)?.product) {
        setError('Cannot compare the same folder with itself in production. Please select different folders or use different products.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/organization/directories/files?path=${encodeURIComponent(directory.path)}&product=${encodeURIComponent(directory.product)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load images for directory ${directory.path}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.files) || data.files.length === 0) {
        throw new Error(`No files found in directory ${directory.path}`);
      }

      const files = data.files.map((file: { name: string; url: string; product: string }) => ({
        file: null,
        name: file.name,
        url: file.url,
        product: file.product
      }));

      onDirectorySelect(version, files, directory.path);
      onNameUpdate(version, directory.name);
      setSelectedDirectories(prev => ({
        ...prev,
        [version]: directory.path
      }));
    } catch (err) {
      console.error('Error in handleDirectorySelect:', err);
      setError(`Failed to load images: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComparisonSetSelect = async (set: ComparisonSet) => {
    // In production, prevent selecting sets that compare the same folder with same product
    if (process.env.NODE_ENV === 'production') {
      const dir1Parts = set.directoryV1.split('/');
      const dir2Parts = set.directoryV2.split('/');
      
      // Check if both paths and products are identical
      if (set.directoryV1 === set.directoryV2 && dir1Parts[1] === dir2Parts[1]) {
        setError('Cannot compare the same folder with itself in production. Please select a different comparison set.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      // Prefer the set's batch labels (job-id comparisons store names as
      // metadata); fall back to the last path segment for legacy name-based sets.
      const getDirectoryName = (path: string, label?: string | null) => {
        if (label && label.trim()) return label;
        const parts = path.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
      };

      // Load directory 1
      await handleDirectorySelect('v1', {
        name: getDirectoryName(set.directoryV1, set.batchALabel),
        path: set.directoryV1,
        count: 0, // This will be updated when loading the directory
        product: set.directoryV1.split('/')[1] || ''
      });

      // Load directory 2
      await handleDirectorySelect('v2', {
        name: getDirectoryName(set.directoryV2, set.batchBLabel),
        path: set.directoryV2,
        count: 0, // This will be updated when loading the directory
        product: set.directoryV2.split('/')[1] || ''
      });

      // Pass the comparison set ID to the parent
      onComparisonSetSelect?.(set.id);
    } catch (err) {
      console.error('Error loading comparison set:', err);
      setError(`Failed to load comparison set: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Deep-link: auto-select the requested comparison set once it has loaded.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoSelectSetId || autoSelectedRef.current) return;
    const match = comparisonSets.find(s => s.id === autoSelectSetId);
    if (match) {
      autoSelectedRef.current = true;
      handleComparisonSetSelect(match);
    }
    // handleComparisonSetSelect is stable enough for this one-shot guarded effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectSetId, comparisonSets]);

  // Get unique products from directories
  const products = Array.from(new Set(directories.map(dir => dir.product))).filter(Boolean);

  // Filter directories by selected product
  const filteredDirectories = selectedProduct
    ? directories.filter(dir => dir.product === selectedProduct)
    : directories;

  if (loading) {
    return <div className="text-center">Loading directories...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800">{error}</p>
        {!session?.user ? (
          <p className="mt-2 text-sm text-yellow-700">
            Please <Button variant="link" className="h-auto p-0 text-yellow-700 underline" onClick={() => router.push('/auth/signin')}>sign in</Button> to access preset directories.
          </p>
        ) : !session.user.organizationId ? (
          <p className="mt-2 text-sm text-yellow-700">
            Please <a href="/dashboard/organization/join" className="font-medium underline">join an organization</a> to access image directories.
          </p>
        ) : !session.user.isCurrentSession && !session.user.isApprovedMember && (
          <p className="mt-2 text-sm text-yellow-700">
            Your organization membership is pending approval. Please wait for an admin to activate your account.
          </p>
        )}
      </div>
    );
  }

  // Show join organization message if user has no organization
  if (!session?.user?.organizationId) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800">
          You need to join an organization first.
        </p>
        <p className="mt-2 text-sm text-yellow-700">
          Please <a href="/dashboard/organization/join" className="font-medium underline">join an organization</a> to access image directories.
        </p>
      </div>
    );
  }

  // Then check for PiktID access
  if (!directories.length) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800">
          No directories available in your organization.
        </p>
        <p className="mt-2 text-sm text-yellow-700">
          Please contact your administrator to set up image directories for your organization at path: {currentOrg?.organizationName.toLowerCase()}/
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="comparison-sets">Comparison Sets</TabsTrigger>
          <TabsTrigger value="manual">Manual Selection</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison-sets">
          <div className="grid gap-4">
            {comparisonSets.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    No comparison sets available. Organization admins can create comparison sets from the organization management page.
                  </p>
                </CardContent>
              </Card>
            ) : (
              comparisonSets.map((set) => {
                const isSelected = selectedDirectories.v1 === set.directoryV1 && selectedDirectories.v2 === set.directoryV2;
                return (
                  <Card 
                    key={set.id} 
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleComparisonSetSelect(set)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{set.name}</CardTitle>
                          {set.description && (
                            <CardDescription>{set.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant={isSelected ? "default" : "secondary"}>
                          {isSelected ? "Selected" : "Created by " + (set.createdBy.name || set.createdBy.email)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label>Directory 1</Label>
                          <p className="font-mono mt-1">{set.directoryV1}</p>
                        </div>
                        <div>
                          <Label>Directory 2</Label>
                          <p className="font-mono mt-1">{set.directoryV2}</p>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4 gap-2">
                        {isSelected && (
                          <>
                            <Button 
                              variant="outline" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDirectories({ v1: null, v2: null });
                              }}
                            >
                              Deselect
                            </Button>
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onStart();
                              }}
                              disabled={!isReadyToStart}
                            >
                              Start Comparison
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Manual Directory Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Select directories manually from your organization's S3 bucket
                </p>
              </div>
              {selectedProduct && (
                <Badge variant="secondary" className="text-xs">
                  Filtering by: {selectedProduct}
                </Badge>
              )}
            </div>

            <Select
              value={selectedProduct || 'all'}
              onValueChange={(value) => setSelectedProduct(value === 'all' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by product..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {Array.from(new Set(directories.map(d => d.product))).map(product => (
                  <SelectItem key={product} value={product}>
                    {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Directory 1 Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Directory 1</CardTitle>
                  <CardDescription>Select the first directory to compare</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {directories
                    .filter(dir => !selectedProduct || dir.product === selectedProduct)
                    .map(directory => (
                      <div
                        key={directory.path}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedDirectories.v1 === directory.path
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleDirectorySelect('v1', directory);
                          setSelectedTab("manual");
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{directory.name}</p>
                            <p className="text-sm text-muted-foreground">{directory.product}</p>
                          </div>
                          <Badge variant="secondary">{directory.count} images</Badge>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Directory 2 Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Directory 2</CardTitle>
                  <CardDescription>Select the second directory to compare</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {directories
                    .filter(dir => !selectedProduct || dir.product === selectedProduct)
                    .map(directory => (
                      <div
                        key={directory.path}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedDirectories.v2 === directory.path
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleDirectorySelect('v2', directory);
                          setSelectedTab("manual");
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{directory.name}</p>
                            <p className="text-sm text-muted-foreground">{directory.product}</p>
                          </div>
                          <Badge variant="secondary">{directory.count} images</Badge>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>

            {/* Status and Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div>
                {selectedDirectories.v1 && selectedDirectories.v2 ? (
                  <p className="text-sm text-muted-foreground">
                    Ready to compare directories
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {!selectedDirectories.v1 && !selectedDirectories.v2 
                      ? "Select directories to compare"
                      : !selectedDirectories.v1 
                        ? "Select first directory" 
                        : "Select second directory"}
                  </p>
                )}
              </div>
              {selectedDirectories.v1 && selectedDirectories.v2 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedDirectories({ v1: null, v2: null });
                    }}
                  >
                    Clear Selection
                  </Button>
                  <Button 
                    onClick={onStart}
                    disabled={!isReadyToStart}
                  >
                    Start Comparison
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="p-4 text-sm text-blue-500 bg-blue-50 rounded-lg">
          Loading...
        </div>
      )}
    </div>
  );
}; 