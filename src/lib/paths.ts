/**
 * Directory-path helpers.
 *
 * Image directories are keyed as `organization/product/version` (the same layout
 * used as the S3 prefix). Historically a lot of bugs came from inconsistent
 * trailing slashes and duplicated normalization logic, so it lives here in one
 * pure, tested place.
 */

/**
 * Normalize a directory path:
 * - collapse repeated slashes
 * - strip a trailing slash
 * - for full `org/product/version...` paths, keep org + product and re-join the
 *   remainder as the version (versions may themselves contain slashes)
 */
export function normalizeDirectoryPath(path: string): string {
  const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '')

  // Version-only path (no separators) — return as-is.
  if (!normalized.includes('/')) {
    return normalized
  }

  const parts = normalized.split('/').filter(Boolean)

  // Full path: org / product / version(+). Preserve slashes inside the version.
  if (parts.length >= 3) {
    const [org, product, ...rest] = parts
    return `${org}/${product}/${rest.join('/')}`
  }

  return normalized
}

/** Split a normalized `org/product/version` path into its parts (best-effort). */
export function parseDirectoryPath(path: string): {
  organization?: string
  product?: string
  version?: string
} {
  const parts = normalizeDirectoryPath(path).split('/').filter(Boolean)
  if (parts.length < 3) return {}
  const [organization, product, ...rest] = parts
  return { organization, product, version: rest.join('/') }
}
