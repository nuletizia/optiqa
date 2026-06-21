import { describe, it, expect, vi } from 'vitest'
import { uploadBatch } from './upload'

// Minimal File stand-in: uploadBatch only reads .name and .type.
function fakeFile(name: string, type = 'image/png'): File {
  return { name, type } as unknown as File
}

function okJson(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response
}

describe('uploadBatch', () => {
  it('uploads every file via presign + PUT and reports success', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === 'string' && input.includes('/upload/presigned')) {
        return okJson({ success: true, url: 'https://s3.example/put' })
      }
      return { ok: true } as unknown as Response // the PUT
    }) as unknown as typeof fetch

    const files = [fakeFile('a.png'), fakeFile('b.png'), fakeFile('c.png')]
    const result = await uploadBatch(files, 'prod/batch-a', { fetchImpl, concurrency: 2 })

    expect(result.successCount).toBe(3)
    expect(result.failureCount).toBe(0)
    expect(result.results.every(r => r.status === 'completed')).toBe(true)
    // 2 calls per file (presign + PUT)
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(6)
  })

  it('sends fileName, contentType and path to the presign endpoint', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === 'string' && input.includes('/upload/presigned')) {
        return okJson({ success: true, url: 'https://s3.example/put' })
      }
      return { ok: true } as unknown as Response
    }) as unknown as typeof fetch

    await uploadBatch([fakeFile('photo_01.jpg', 'image/jpeg')], 'prod/v1', { fetchImpl })

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>
    const presignCall = mock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/upload/presigned'),
    )!
    expect(JSON.parse((presignCall[1] as RequestInit).body as string)).toEqual({
      fileName: 'photo_01.jpg',
      contentType: 'image/jpeg',
      path: 'prod/v1',
    })
  })

  it('records per-file failures without rejecting the batch', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.includes('/upload/presigned')) {
        // Fail presign for the second file only.
        const body = JSON.parse((init?.body as string) ?? '{}')
        if (body.fileName === 'bad.png') return { ok: false } as unknown as Response
        return okJson({ success: true, url: 'https://s3.example/put' })
      }
      return { ok: true } as unknown as Response
    }) as unknown as typeof fetch

    const result = await uploadBatch([fakeFile('good.png'), fakeFile('bad.png')], 'p/v', {
      fetchImpl,
      concurrency: 1,
    })

    expect(result.successCount).toBe(1)
    expect(result.failureCount).toBe(1)
    expect(result.results[1].status).toBe('error')
  })

  it('never exceeds the configured concurrency', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight--
      if (typeof input === 'string' && input.includes('/upload/presigned')) {
        return okJson({ success: true, url: 'https://s3.example/put' })
      }
      return { ok: true } as unknown as Response
    }) as unknown as typeof fetch

    const files = Array.from({ length: 10 }, (_, i) => fakeFile(`f${i}.png`))
    await uploadBatch(files, 'p/v', { fetchImpl, concurrency: 3 })

    expect(maxInFlight).toBeLessThanOrEqual(3)
  })
})
