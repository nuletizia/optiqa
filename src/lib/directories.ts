import { listCommonPrefixes, countImages, listObjects, isImageKey, getPresignedDownloadUrl } from '@/lib/s3'

export interface VersionDirectory {
  name: string
  path: string
  imageCount: number
  product: string
}

export interface DirectoryImage {
  name: string
  url: string
  product: string
}

/**
 * Walk the `organization/product/version` layout in S3 and return every version
 * directory that contains at least one image. Shared by the products API and the
 * directory-picker endpoints so the traversal lives in one place.
 */
export async function listVersionDirectories(
  organizationName: string,
): Promise<VersionDirectory[]> {
  const organizationPath = organizationName.toLowerCase()

  const productPrefixes = await listCommonPrefixes(`${organizationPath}/`)
  const products = productPrefixes
    .map((prefix) => prefix.split('/')[1])
    .filter((product): product is string => Boolean(product))

  const allDirectories = await Promise.all(
    products.map(async (product) => {
      const versionPrefixes = await listCommonPrefixes(`${organizationPath}/${product}/`)

      return Promise.all(
        versionPrefixes.map(async (prefix) => {
          const imageCount = await countImages(prefix)
          const pathParts = prefix.split('/').filter(Boolean)
          const dirName = pathParts[pathParts.length - 1] || ''
          return { name: dirName, path: prefix, imageCount, product }
        }),
      )
    }),
  )

  return allDirectories.flat().filter((dir) => dir.imageCount > 0)
}

/**
 * List the images in a single directory, returning presigned URLs the browser can
 * load directly (so AWS credentials never reach the client).
 */
export async function listDirectoryImages(
  directoryPath: string,
  product: string,
): Promise<DirectoryImage[]> {
  const objects = await listObjects(directoryPath, { maxKeys: 1000 })
  const imageObjects = objects.filter((obj) => isImageKey(obj.Key))

  return Promise.all(
    imageObjects.map(async (obj) => ({
      name: obj.Key!.split('/').pop() || '',
      url: await getPresignedDownloadUrl(obj.Key!),
      product,
    })),
  )
}
