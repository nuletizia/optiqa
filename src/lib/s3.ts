import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  type _Object,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Server-only S3 access.
 *
 * Credentials come from server-side env vars (NOT `NEXT_PUBLIC_*`, which would
 * bundle the secret key into the browser). All S3 access in the app goes through
 * this module so the bucket and credentials are configured in exactly one place.
 */

const region = process.env.AWS_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? ''

if (!region || !accessKeyId || !secretAccessKey || !S3_BUCKET) {
  // Don't throw at import time (keeps non-S3 routes working in misconfigured
  // dev environments); individual calls will fail clearly if S3 is unconfigured.
  console.warn(
    '[s3] Missing AWS configuration. Set AWS_REGION, AWS_ACCESS_KEY_ID, ' +
      'AWS_SECRET_ACCESS_KEY and S3_BUCKET_NAME to enable S3 features.',
  )
}

export const s3Client = new S3Client({
  region,
  credentials:
    accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
})

/** Matches the image file extensions the app supports. */
export const IMAGE_EXTENSION_RE = /\.(jpg|jpeg|png|gif|webp)$/i

export function isImageKey(key: string | undefined): key is string {
  return Boolean(key && IMAGE_EXTENSION_RE.test(key))
}

/**
 * List the immediate "subfolders" (CommonPrefixes) under a prefix.
 * Returns the raw prefixes (each ending in `/`).
 */
export async function listCommonPrefixes(prefix?: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    }),
  )
  return (response.CommonPrefixes ?? [])
    .map((p) => p.Prefix)
    .filter((p): p is string => Boolean(p))
}

/** List all objects under a prefix (handles pagination). */
export async function listObjects(
  prefix: string,
  opts?: { maxKeys?: number },
): Promise<_Object[]> {
  const objects: _Object[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        MaxKeys: opts?.maxKeys,
        ContinuationToken: continuationToken,
      }),
    )
    objects.push(...(response.Contents ?? []))
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken && !opts?.maxKeys)

  return objects
}

/** Count the image files directly addressable under a prefix. */
export async function countImages(prefix: string): Promise<number> {
  const objects = await listObjects(prefix, { maxKeys: 1000 })
  return objects.filter((o) => isImageKey(o.Key)).length
}

/** Presigned URL the browser can PUT an upload to. */
export function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  )
}

/** Presigned URL the browser can GET an object from (for private buckets). */
export function getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn },
  )
}
