"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, ArrowRight, Plus, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

interface Props {
  organizationId: string
}

type Step = 'product' | 'version' | 'upload'

interface Version {
  name: string;
  path: string;
  files: string[];
  pattern: string;
  fileCount: number;
}

interface Product {
  name: string;
  path: string;
  filePattern?: string;
  sampleFiles?: string[];
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

// Add constants for file limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 50; // Maximum number of files that can be uploaded at once
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function UploadManagement({ organizationId }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('product')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [newProductName, setNewProductName] = useState('')
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [filePattern, setFilePattern] = useState<string>('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  // Load existing products
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/organization/products');
        if (!response.ok) throw new Error('Failed to load products');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load products');
        }

        setProducts(data.products);
      } catch (err) {
        console.error('Error loading products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products')
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [organizationId])

  // Modify loadExistingFiles to load all versions
  const loadExistingFiles = async (productName: string) => {
    try {
      const response = await fetch(`/api/organization/products/${productName}/files`);
      if (!response.ok) throw new Error('Failed to load existing files');
      const data = await response.json();
      
      if (data.versions && data.versions.length > 0) {
        setVersions(data.versions);
        setExistingFiles([]);
        setFilePattern('');
      } else {
        setVersions([]);
        setExistingFiles([]);
        setFilePattern('');
      }
    } catch (err) {
      console.error('Error loading existing files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load existing files');
    }
  };

  // Add version selection handler
  const handleVersionSelect = (version: Version) => {
    setSelectedVersion(version);
    setExistingFiles(version.files);
    setFilePattern(version.pattern);
  };

  // Modify product selection handler
  const handleProductSelect = (productName: string) => {
    setSelectedProduct(productName);
    loadExistingFiles(productName);
  };

  // Add filename validation to onDrop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check total number of files
    if (uploadingFiles.length + acceptedFiles.length > MAX_FILE_COUNT) {
      setError(`Maximum number of files allowed is ${MAX_FILE_COUNT}`);
      return;
    }

    // First do the existing validations
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return false;
      }

      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError(`File ${file.name} has unsupported type. Allowed types are: JPG, PNG, GIF, WebP`);
        return false;
      }

      // If there's a file pattern, validate against it
      if (filePattern && existingFiles.length > 0) {
        const pattern = filePattern.replace('*', '\\d+');
        const regex = new RegExp(pattern);
        if (!regex.test(file.name)) {
          setError(`File ${file.name} doesn't match the required pattern: ${filePattern}`);
          return false;
        }
      }

      return true;
    });

    const newFiles = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);
  }, [filePattern, existingFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    }
  });

  const removeFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  const uploadFiles = async () => {
    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    const productPath = isCreatingNewProduct ? newProductName : selectedProduct;
    const targetPath = `${productPath}/${versionName}`;
    let successCount = 0;
    let failureCount = 0;

    for (const fileData of uploadingFiles) {
      if (fileData.status === 'completed') continue;

      try {
        // Update file status to uploading
        setUploadingFiles(prev => prev.map(f => 
          f.file === fileData.file ? { ...f, status: 'uploading', progress: 10 } : f
        ));

        // Get presigned URL
        const presignedResponse = await fetch('/api/organization/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileData.file.name,
            contentType: fileData.file.type,
            path: targetPath
          })
        });

        if (!presignedResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const data = await presignedResponse.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to get upload URL');
        }

        setUploadingFiles(prev => prev.map(f => 
          f.file === fileData.file ? { ...f, progress: 30 } : f
        ));

        // Upload directly to S3
        const uploadResponse = await fetch(data.url, {
          method: 'PUT',
          body: fileData.file,
          headers: {
            'Content-Type': fileData.file.type
          }
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        // Update file status to completed
        setUploadingFiles(prev => prev.map(f => 
          f.file === fileData.file ? { ...f, status: 'completed', progress: 100 } : f
        ));
        successCount++;

      } catch (err) {
        console.error('Error uploading file:', err);
        setUploadingFiles(prev => prev.map(f => 
          f.file === fileData.file ? {
            ...f,
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
            progress: 0
          } : f
        ));
        failureCount++;
      }
    }

    setIsUploading(false);

    // Show success message and redirect after a delay if all files uploaded successfully
    if (successCount > 0) {
      const message = failureCount === 0 
        ? `Successfully uploaded ${successCount} ${successCount === 1 ? 'file' : 'files'}`
        : `Uploaded ${successCount} ${successCount === 1 ? 'file' : 'files'}, ${failureCount} failed`;
      
      setSuccessMessage(message);

      if (failureCount === 0) {
        // Clear only the files list on complete success
        setUploadingFiles(prev => prev.map(f => ({ ...f, status: 'completed' })));
      }
    }
  };

  const handleProductStep = () => {
    if (isCreatingNewProduct) {
      // Validate new product name
      if (!newProductName.trim()) {
        setError('Please enter a product name');
        return;
      }
      if (!/^[a-zA-Z0-9-]+$/.test(newProductName)) {
        setError('Product name can only contain letters, numbers, and hyphens');
        return;
      }
      if (products.some(p => p.name.toLowerCase() === newProductName.toLowerCase())) {
        setError('Product with this name already exists');
        return;
      }
    } else {
      // Validate product selection
      if (!selectedProduct) {
        setError('Please select a product');
        return;
      }
    }

    setError(null);
    setCurrentStep('version');
  }

  const handleVersionStep = () => {
    // Validate version name
    if (!versionName.trim()) {
      setError('Please enter a version/folder name');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(versionName)) {
      setError('Version name can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setError(null);
    setCurrentStep('upload');
  }

  const renderProductStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Select Product</h3>
          <Button
            variant="ghost"
            onClick={() => {
              setIsCreatingNewProduct(!isCreatingNewProduct);
              setSelectedProduct(null);
              setSelectedVersion(null);
              setVersions([]);
            }}
          >
            {isCreatingNewProduct ? (
              'Select Existing Product'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create New Product
              </>
            )}
          </Button>
        </div>

        {isCreatingNewProduct ? (
          <div className="space-y-2">
            <Label htmlFor="newProduct">New Product Name</Label>
            <Input
              id="newProduct"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Enter product name"
            />
            <p className="text-sm text-muted-foreground">
              Product name can only contain letters, numbers, and hyphens
            </p>
          </div>
        ) : (
          <Select
            value={selectedProduct || ''}
            onValueChange={handleProductSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.path} value={product.name}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleProductStep}
          disabled={loading}
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const renderVersionStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Version/Folder Name</h3>
          <Button
            variant="ghost"
            onClick={() => setCurrentStep('product')}
          >
            Back to Product Selection
          </Button>
        </div>

        {!isCreatingNewProduct && versions.length > 0 && (
          <div className="space-y-2">
            <Label>Select Version to Match Pattern (Optional)</Label>
            <Select
              defaultValue="no-pattern"
              value={selectedVersion?.name || 'no-pattern'}
              onValueChange={(value) => {
                if (value === 'no-pattern') {
                  setSelectedVersion(null);
                  setExistingFiles([]);
                  setFilePattern('');
                  return;
                }
                const version = versions.find(v => v.name === value);
                if (version) handleVersionSelect(version);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a version or continue without pattern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-pattern">Do not match pattern</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version.path} value={version.name}>
                    {version.name} ({version.fileCount} files)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="version">New Version Name</Label>
          <Input
            id="version"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Enter version/folder name"
          />
          <p className="text-sm text-muted-foreground">
            Version name can only contain letters, numbers, underscores, and hyphens
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-muted">
          <p className="text-sm font-medium">Files will be uploaded to:</p>
          <p className="text-sm font-mono mt-1">
            {isCreatingNewProduct ? newProductName : selectedProduct}/{versionName}/
          </p>
        </div>
      </div>

      {selectedVersion && (
        <div className="rounded-lg border p-4 bg-blue-50 space-y-2">
          <p className="text-sm font-medium text-blue-800">
            Important: File Name Pattern Required
          </p>
          <p className="text-sm text-blue-700">
            Your files must match the pattern from version "{selectedVersion.name}" (without file extension): <code className="bg-blue-100 px-1 py-0.5 rounded">{selectedVersion.pattern}</code>
          </p>
          <p className="text-sm text-blue-700">
            Examples from {selectedVersion.name}:
          </p>
          <ul className="text-sm text-blue-700 list-disc list-inside">
            {selectedVersion.files.slice(0, 3).map(file => {
              const nameWithoutExt = file.split('/').pop()?.split('.')[0] || '';
              return (
                <li key={file} className="font-mono text-xs">{nameWithoutExt}</li>
              );
            })}
            {selectedVersion.files.length > 3 && <li>...</li>}
          </ul>
          <p className="text-sm text-blue-700 mt-2">
            Note: File extensions (e.g., .jpg, .png) are ignored during comparison. Only the filename without extension needs to match.
          </p>
        </div>
      )}

      {!selectedVersion && !isCreatingNewProduct && versions.length > 0 && (
        <div className="rounded-lg border p-4 bg-yellow-50">
          <p className="text-sm text-yellow-800">
            You can select a version above to match its filename pattern, or continue without pattern matching.
          </p>
        </div>
      )}

      {!selectedVersion && !isCreatingNewProduct && versions.length === 0 && (
        <div className="rounded-lg border p-4 bg-yellow-50">
          <p className="text-sm text-yellow-800">
            No existing versions found in this product. Your uploaded files will set the pattern for future uploads.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleVersionStep}
          disabled={loading}
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Upload Images</h3>
        <Button
          variant="ghost"
          onClick={() => setCurrentStep('version')}
        >
          Back to Version Selection
        </Button>
      </div>

      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary'}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
        <p className="text-sm text-gray-600">
          {isDragActive ?
            'Drop the files here...' :
            'Drag & drop image files here, or click to select files'
          }
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Supported formats: JPG, PNG, GIF, WebP
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Files to Upload</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadingFiles([])}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {uploadingFiles.map((fileData) => (
              <div 
                key={fileData.file.name}
                className="flex items-center gap-4 p-2 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileData.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileData.status === 'error' && (
                    <p className="text-xs text-red-500">{fileData.error}</p>
                  )}
                </div>
                <Progress 
                  value={fileData.progress} 
                  className="w-24"
                />
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(fileData.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={uploadFiles}
            disabled={isUploading || uploadingFiles.length === 0 || uploadingFiles.every(f => f.status === 'completed')}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {uploadingFiles.filter(f => f.status !== 'completed').length} {uploadingFiles.filter(f => f.status !== 'completed').length === 1 ? 'File' : 'Files'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
          <CardDescription>
            Upload images to your organization's S3 bucket. Files must match existing naming patterns for comparison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 text-sm text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 text-sm text-green-700 bg-green-50 rounded-lg">
              {successMessage}
            </div>
          )}

          {currentStep === 'product' && renderProductStep()}
          {currentStep === 'version' && renderVersionStep()}
          {currentStep === 'upload' && renderUploadStep()}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Maximum file size: {MAX_FILE_SIZE / 1024 / 1024}MB</p>
        <p>Maximum number of files: {MAX_FILE_COUNT}</p>
        <p>Supported formats: JPG, PNG, GIF, WebP</p>
      </div>
    </div>
  )
} 