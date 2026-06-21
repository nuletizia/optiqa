"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, ArrowRight, ArrowLeft, Plus, Upload, X, FolderOpen, CheckCircle2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { uploadBatch, type FileUploadState } from '@/lib/upload'

interface Props {
  organizationId: string
}

type Step = 'details' | 'upload' | 'done'

interface Product {
  name: string
  path: string
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILE_COUNT = 1000
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const PRODUCT_NAME_RE = /^[a-zA-Z0-9-]+$/
const VERSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

// Keep only the basename — uploads flatten any dropped folder structure.
const basename = (file: File) => file.name.split('/').pop() || file.name

function validateIncoming(
  incoming: File[],
  existingCount: number,
): { valid: File[]; error: string | null } {
  if (existingCount + incoming.length > MAX_FILE_COUNT) {
    return { valid: [], error: `Maximum number of files allowed is ${MAX_FILE_COUNT}` }
  }
  for (const file of incoming) {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: [], error: `File ${file.name} is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return { valid: [], error: `File ${file.name} has an unsupported type. Allowed: JPG, PNG, GIF, WebP` }
    }
  }
  return { valid: incoming, error: null }
}

interface BatchUploaderProps {
  label: string
  targetPath: string
  hint?: string
  onComplete: (successCount: number) => void
}

/** Drop / pick a folder of images and upload them in parallel to `targetPath`. */
function BatchUploader({ label, targetPath, hint, onComplete }: BatchUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [states, setStates] = useState<FileUploadState[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [aggregate, setAggregate] = useState({ total: 0, completed: 0, failed: 0 })
  const [error, setError] = useState<string | null>(null)
  const [finishedCount, setFinishedCount] = useState<number | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // <input webkitdirectory> isn't a typed React prop — set it imperatively.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
    }
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    setError(null)
    setFinishedCount(null)
    setFiles(prev => {
      const images = incoming.filter(f => ALLOWED_FILE_TYPES.includes(f.type))
      const { valid, error: validationError } = validateIncoming(images, prev.length)
      if (validationError) {
        setError(validationError)
        return prev
      }
      // De-duplicate by basename so a file isn't uploaded twice.
      const seen = new Set(prev.map(basename))
      const deduped = valid.filter(f => !seen.has(basename(f)))
      return [...prev, ...deduped]
    })
  }, [])

  const onDrop = useCallback((accepted: File[]) => addFiles(accepted), [addFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
  })

  const removeFile = (file: File) => setFiles(prev => prev.filter(f => f !== file))
  const clearAll = () => {
    setFiles([])
    setStates([])
    setAggregate({ total: 0, completed: 0, failed: 0 })
    setFinishedCount(null)
  }

  const startUpload = async () => {
    setIsUploading(true)
    setError(null)
    setStates(files.map(() => ({ status: 'pending', progress: 0 })))
    setAggregate({ total: files.length, completed: 0, failed: 0 })

    const result = await uploadBatch(files, targetPath, {
      concurrency: 5,
      onFileProgress: (index, state) =>
        setStates(prev => {
          const next = [...prev]
          next[index] = state
          return next
        }),
      onAggregateProgress: setAggregate,
    })

    setIsUploading(false)
    setFinishedCount(result.successCount)
    if (result.failureCount > 0) {
      setError(`${result.failureCount} file(s) failed to upload. You can retry the upload.`)
    }
    onComplete(result.successCount)
  }

  const allDone = finishedCount !== null && aggregate.failed === 0 && files.length > 0
  const aggregatePct = aggregate.total > 0
    ? Math.round(((aggregate.completed + aggregate.failed) / aggregate.total) * 100)
    : 0

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{label}</h4>
          <p className="text-xs font-mono text-muted-foreground">{targetPath}/</p>
        </div>
        {allDone && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> {finishedCount} uploaded
          </span>
        )}
      </div>

      {hint && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{hint}</p>}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary'}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          {isDragActive ? 'Drop the folder or files here…' : 'Drag & drop a folder (or images) here, or click to select files'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => addFiles(Array.from(e.target.files ?? []))}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
          <FolderOpen className="h-4 w-4 mr-2" /> Select folder
        </Button>
        {files.length > 0 && (
          <span className="text-xs text-muted-foreground">{files.length} file(s) selected</span>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-2">
          {isUploading || finishedCount !== null ? (
            <div className="space-y-1">
              <Progress value={aggregatePct} />
              <p className="text-xs text-muted-foreground">
                {aggregate.completed} uploaded
                {aggregate.failed > 0 ? `, ${aggregate.failed} failed` : ''} of {aggregate.total}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ready to upload {files.length} file(s)</span>
              <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{basename(file)}</span>
                {states[index]?.status === 'error' && <span className="text-red-500">failed</span>}
                {states[index]?.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                {!isUploading && finishedCount === null && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(file)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!allDone && (
            <Button className="w-full" onClick={startUpload} disabled={isUploading || files.length === 0}>
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
              ) : finishedCount !== null ? (
                <><Upload className="mr-2 h-4 w-4" /> Retry upload</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Upload {files.length} file(s)</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function UploadManagement({ organizationId }: Props) {
  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // "Comparison" maps to an S3 product folder.
  const [products, setProducts] = useState<Product[]>([])
  const [isNewComparison, setIsNewComparison] = useState(true)
  const [newComparisonName, setNewComparisonName] = useState('')
  const [selectedComparison, setSelectedComparison] = useState<string | null>(null)
  const [batchAName, setBatchAName] = useState('')
  const [batchBName, setBatchBName] = useState('')

  // Upload progress per batch.
  const [batchAUploaded, setBatchAUploaded] = useState(0)
  const [batchBUploaded, setBatchBUploaded] = useState(0)

  // Comparison-set creation on the done screen.
  const [createSet, setCreateSet] = useState(true)
  const [setName, setSetName] = useState('')
  const [setCreated, setSetCreated] = useState(false)
  const [creatingSet, setCreatingSet] = useState(false)

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/organization/products')
        if (!response.ok) throw new Error('Failed to load comparisons')
        const data = await response.json()
        if (!data.success) throw new Error(data.error || 'Failed to load comparisons')
        setProducts(data.products)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comparisons')
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [organizationId])

  const comparisonName = isNewComparison ? newComparisonName : (selectedComparison ?? '')

  const handleDetailsNext = () => {
    if (isNewComparison) {
      if (!newComparisonName.trim()) return setError('Please name the comparison')
      if (!PRODUCT_NAME_RE.test(newComparisonName)) return setError('Comparison name can only contain letters, numbers, and hyphens')
      if (products.some(p => p.name.toLowerCase() === newComparisonName.toLowerCase()))
        return setError('A comparison with this name already exists')
    } else if (!selectedComparison) {
      return setError('Please select a comparison')
    }
    if (!batchAName.trim() || !batchBName.trim()) return setError('Please name both batches')
    if (!VERSION_NAME_RE.test(batchAName) || !VERSION_NAME_RE.test(batchBName))
      return setError('Batch names can only contain letters, numbers, underscores, and hyphens')
    if (batchAName === batchBName) return setError('The two batches must have different names')

    setError(null)
    setSetName(comparisonName)
    setStep('upload')
  }

  const handleFinish = async () => {
    if (!createSet) {
      setStep('done')
      return
    }
    setCreatingSet(true)
    setError(null)
    try {
      const response = await fetch('/api/organization/comparison-sets/from-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: setName || comparisonName,
          product: comparisonName,
          versionA: batchAName,
          versionB: batchBName,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to create comparison set')
      setSetCreated(true)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create comparison set')
    } finally {
      setCreatingSet(false)
    }
  }

  const resetWizard = () => {
    setStep('details')
    setIsNewComparison(true)
    setNewComparisonName('')
    setSelectedComparison(null)
    setBatchAName('')
    setBatchBName('')
    setBatchAUploaded(0)
    setBatchBUploaded(0)
    setCreateSet(true)
    setSetName('')
    setSetCreated(false)
    setError(null)
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const bothUploaded = batchAUploaded > 0 && batchBUploaded > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Set up a comparison</CardTitle>
          <CardDescription>
            Upload two batches of images — version A and version B — so your team can vote on which is higher quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg">{error}</div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">What are you comparing?</h3>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsNewComparison(!isNewComparison)
                      setSelectedComparison(null)
                      setNewComparisonName('')
                    }}
                  >
                    {isNewComparison ? 'Use existing comparison' : (
                      <><Plus className="h-4 w-4 mr-2" /> New comparison</>
                    )}
                  </Button>
                </div>

                {isNewComparison ? (
                  <div className="space-y-2">
                    <Label htmlFor="comparison">Comparison name</Label>
                    <Input
                      id="comparison"
                      value={newComparisonName}
                      onChange={e => setNewComparisonName(e.target.value)}
                      placeholder="e.g. portraits-q3"
                    />
                    <p className="text-sm text-muted-foreground">Letters, numbers, and hyphens only.</p>
                  </div>
                ) : (
                  <Select value={selectedComparison ?? ''} onValueChange={setSelectedComparison}>
                    <SelectTrigger><SelectValue placeholder="Select a comparison" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.path} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchA">Batch A name</Label>
                  <Input id="batchA" value={batchAName} onChange={e => setBatchAName(e.target.value)} placeholder="e.g. baseline" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchB">Batch B name</Label>
                  <Input id="batchB" value={batchBName} onChange={e => setBatchBName(e.target.value)} placeholder="e.g. new-model" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleDetailsNext}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Upload images</h3>
                <Button variant="ghost" onClick={() => setStep('details')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BatchUploader
                  label={`Batch A — ${batchAName}`}
                  targetPath={`${comparisonName}/${batchAName}`}
                  onComplete={setBatchAUploaded}
                />
                <BatchUploader
                  label={`Batch B — ${batchBName}`}
                  targetPath={`${comparisonName}/${batchBName}`}
                  hint="Reuse Batch A's filenames so images pair up by name during evaluation."
                  onComplete={setBatchBUploaded}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleFinish} disabled={!bothUploaded || creatingSet}>
                  {creatingSet ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finishing…</> : 'Finish'}
                  {!creatingSet && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>

              {bothUploaded && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="createSet" checked={createSet} onCheckedChange={v => setCreateSet(Boolean(v))} />
                    <Label htmlFor="createSet">Create a comparison set so members can evaluate right away</Label>
                  </div>
                  {createSet && (
                    <div className="space-y-2">
                      <Label htmlFor="setName">Comparison set name</Label>
                      <Input id="setName" value={setName} onChange={e => setSetName(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <h3 className="text-lg font-medium">Comparison ready</h3>
                <p className="text-sm text-muted-foreground">
                  Uploaded {batchAUploaded} image(s) to Batch A and {batchBUploaded} to Batch B.
                  {setCreated && ' Members can now evaluate it from the comparison sets.'}
                </p>
              </div>
              <Button onClick={resetWizard}>Set up another comparison</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Max file size: {MAX_FILE_SIZE / 1024 / 1024}MB · Max {MAX_FILE_COUNT} files per batch · JPG, PNG, GIF, WebP</p>
      </div>
    </div>
  )
}
