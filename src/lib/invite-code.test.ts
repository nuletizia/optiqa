import { describe, expect, it } from 'vitest'
import { generateInviteCode } from './invite-code'

describe('generateInviteCode', () => {
  it('produces an 8-character code from the expected alphabet by default', () => {
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/)
  })

  it('applies a prefix when given', () => {
    expect(generateInviteCode('ORG')).toMatch(/^ORG-[A-Z0-9]{8}$/)
  })

  it('honours a custom length', () => {
    expect(generateInviteCode(undefined, 12)).toMatch(/^[A-Z0-9]{12}$/)
  })

  it('does not repeat itself across many draws', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()))
    expect(codes.size).toBe(500)
  })
})
