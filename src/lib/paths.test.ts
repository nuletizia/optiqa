import { describe, it, expect } from 'vitest'
import { normalizeDirectoryPath, parseDirectoryPath } from './paths'

describe('normalizeDirectoryPath', () => {
  it('strips a trailing slash', () => {
    expect(normalizeDirectoryPath('org/product/v1/')).toBe('org/product/v1')
  })

  it('collapses repeated slashes', () => {
    expect(normalizeDirectoryPath('org//product///v1')).toBe('org/product/v1')
  })

  it('leaves a clean full path unchanged', () => {
    expect(normalizeDirectoryPath('org/product/v1')).toBe('org/product/v1')
  })

  it('returns a version-only path as-is', () => {
    expect(normalizeDirectoryPath('v1')).toBe('v1')
  })

  it('preserves slashes inside a multi-segment version', () => {
    expect(normalizeDirectoryPath('org/product/2024/batch-a/')).toBe(
      'org/product/2024/batch-a',
    )
  })

  it('handles a two-part path without forcing a version', () => {
    expect(normalizeDirectoryPath('org/product')).toBe('org/product')
  })

  it('is idempotent', () => {
    const once = normalizeDirectoryPath('org//product/v1/')
    expect(normalizeDirectoryPath(once)).toBe(once)
  })
})

describe('parseDirectoryPath', () => {
  it('splits a full path into org/product/version', () => {
    expect(parseDirectoryPath('org/product/v1')).toEqual({
      organization: 'org',
      product: 'product',
      version: 'v1',
    })
  })

  it('joins a multi-segment version back together', () => {
    expect(parseDirectoryPath('org/product/2024/batch-a')).toEqual({
      organization: 'org',
      product: 'product',
      version: '2024/batch-a',
    })
  })

  it('returns empty parts for a non-full path', () => {
    expect(parseDirectoryPath('v1')).toEqual({})
    expect(parseDirectoryPath('org/product')).toEqual({})
  })
})
