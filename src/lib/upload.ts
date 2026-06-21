/**
 * Client-side batch image upload helper.
 *
 * Each file is uploaded in two steps (mirroring the original inline flow in
 * UploadManagement): first ask the server for a presigned S3 PUT URL, then PUT
 * the file straight to S3. This helper runs the files through a
 * concurrency-limited worker pool and reports per-file + aggregate progress so
 * callers can render a single progress bar instead of one-at-a-time uploads.
 */

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

export interface FileUploadState {
  status: UploadStatus;
  /** 0-100 */
  progress: number;
  error?: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
}

export interface UploadBatchOptions {
  /** Max files uploaded simultaneously. Default 5. */
  concurrency?: number;
  /** Called whenever a single file's state changes. */
  onFileProgress?: (index: number, state: FileUploadState) => void;
  /** Called whenever a file finishes (success or failure). */
  onAggregateProgress?: (progress: BatchProgress) => void;
  /** Injectable fetch, primarily for testing. */
  fetchImpl?: typeof fetch;
  /** Abort all in-flight and pending uploads. */
  signal?: AbortSignal;
}

export interface UploadBatchResult {
  successCount: number;
  failureCount: number;
  results: FileUploadState[];
}

async function uploadOne(
  file: File,
  targetPath: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<void> {
  const presignedResponse = await fetchImpl('/api/organization/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      path: targetPath,
    }),
    signal,
  });

  if (!presignedResponse.ok) {
    throw new Error('Failed to get upload URL');
  }

  const data = await presignedResponse.json();
  if (!data.success || !data.url) {
    throw new Error(data.error || 'Failed to get upload URL');
  }

  const uploadResponse = await fetchImpl(data.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
    signal,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Upload `files` to `targetPath` (a `product/version` prefix) through a
 * concurrency-limited pool. Never rejects on individual file failures: failed
 * files are recorded in the returned `results` and counted in `failureCount`.
 */
export async function uploadBatch(
  files: File[],
  targetPath: string,
  options: UploadBatchOptions = {},
): Promise<UploadBatchResult> {
  const {
    concurrency = 5,
    onFileProgress,
    onAggregateProgress,
    fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    signal,
  } = options;

  const results: FileUploadState[] = files.map(() => ({ status: 'pending', progress: 0 }));
  let completed = 0;
  let failed = 0;
  let nextIndex = 0;

  const setFile = (index: number, state: FileUploadState) => {
    results[index] = state;
    onFileProgress?.(index, state);
  };
  const emitAggregate = () =>
    onAggregateProgress?.({ total: files.length, completed, failed });

  async function worker(): Promise<void> {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      if (signal?.aborted) {
        setFile(index, { status: 'error', progress: 0, error: 'Upload cancelled' });
        failed++;
        emitAggregate();
        continue;
      }

      setFile(index, { status: 'uploading', progress: 10 });
      try {
        await uploadOne(files[index], targetPath, fetchImpl, signal);
        setFile(index, { status: 'completed', progress: 100 });
        completed++;
      } catch (err) {
        setFile(index, {
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Upload failed',
        });
        failed++;
      }
      emitAggregate();
    }
  }

  emitAggregate();
  const poolSize = Math.min(Math.max(1, concurrency), files.length || 1);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  return { successCount: completed, failureCount: failed, results };
}
