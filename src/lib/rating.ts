/**
 * Bradley-Terry / Elo-style pairwise rating math.
 *
 * Each entity starts at strength {@link INITIAL_RATING}. On every head-to-head
 * comparison the winner gains and the loser loses an amount scaled by {@link K_FACTOR}
 * and the *expected* outcome (so an upset moves the scores more than an expected win).
 * Ties use half the K factor and nudge both entities toward their expected probability.
 *
 * These are pure functions so the behaviour can be unit-tested in isolation; the
 * React hook `useBradleyTerry` is a thin stateful wrapper around them.
 */

export const INITIAL_RATING = 1000
export const K_FACTOR = 32
/** Strengths never drop below this floor (avoids zero/negative strengths). */
export const MIN_STRENGTH = 1

/** Probability that `a` beats `b` given their current strengths. */
export function expectedProbability(a: number, b: number): number {
  return a / (a + b)
}

/**
 * New strengths after `winnerStrength` beats `loserStrength`.
 * The winner gains `K * (1 - expectedWin)`; the loser loses the same amount,
 * floored at {@link MIN_STRENGTH}.
 */
export function applyWin(
  winnerStrength: number,
  loserStrength: number,
  k: number = K_FACTOR,
): { winner: number; loser: number } {
  const expectedWin = expectedProbability(winnerStrength, loserStrength)
  const change = k * (1 - expectedWin)
  return {
    winner: winnerStrength + change,
    loser: Math.max(MIN_STRENGTH, loserStrength - change),
  }
}

/**
 * New strengths after a tie between `aStrength` and `bStrength`.
 * Uses half the K factor and moves each toward its expected probability of 0.5.
 */
export function applyTie(
  aStrength: number,
  bStrength: number,
  k: number = K_FACTOR,
): { a: number; b: number } {
  const tieK = k * 0.5
  const expectedA = expectedProbability(aStrength, bStrength)
  const expectedB = expectedProbability(bStrength, aStrength)
  return {
    a: Math.max(MIN_STRENGTH, aStrength + tieK * (0.5 - expectedA)),
    b: Math.max(MIN_STRENGTH, bStrength + tieK * (0.5 - expectedB)),
  }
}
