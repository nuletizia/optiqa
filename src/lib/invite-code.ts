import { randomInt } from 'crypto'

/**
 * Alphabet for invite codes: uppercase letters + digits.
 *
 * `I`, `O`, `0` and `1` are intentionally kept (rather than removed for
 * legibility) so existing codes stay valid; codes are copy-pasted, not retyped.
 */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const DEFAULT_LENGTH = 8

/**
 * Generate an organization invite code.
 *
 * Uses `crypto.randomInt` (a CSPRNG) rather than `Math.random`: redeeming a
 * valid code auto-approves the redeemer as a member of the organization, which
 * grants access to that org's images and ratings. `Math.random` is a
 * non-cryptographic PRNG whose internal state can be recovered from observed
 * outputs, so codes generated from it are not safe to treat as secrets.
 *
 * Server-only — `crypto.randomInt` is a Node API.
 *
 * @param prefix Optional human-readable prefix, e.g. `ORG` -> `ORG-A1B2C3D4`.
 * @param length Number of random characters (default 8 => 36^8 ≈ 2.8e12).
 */
export function generateInviteCode(prefix?: string, length: number = DEFAULT_LENGTH): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length))
  }
  return prefix ? `${prefix}-${result}` : result
}
