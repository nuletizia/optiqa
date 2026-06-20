import { describe, it, expect } from 'vitest'
import {
  INITIAL_RATING,
  K_FACTOR,
  MIN_STRENGTH,
  expectedProbability,
  applyWin,
  applyTie,
} from './rating'

describe('expectedProbability', () => {
  it('is 0.5 for equal strengths', () => {
    expect(expectedProbability(1000, 1000)).toBe(0.5)
  })

  it('is higher for the stronger entity', () => {
    expect(expectedProbability(1200, 800)).toBeGreaterThan(0.5)
    expect(expectedProbability(800, 1200)).toBeLessThan(0.5)
  })

  it('the two directions sum to 1', () => {
    expect(expectedProbability(1300, 700) + expectedProbability(700, 1300)).toBeCloseTo(1)
  })
})

describe('applyWin', () => {
  it('moves an even matchup by K/2', () => {
    // expected = 0.5, change = K * (1 - 0.5) = 16
    const { winner, loser } = applyWin(1000, 1000)
    expect(winner).toBeCloseTo(1000 + K_FACTOR * 0.5)
    expect(loser).toBeCloseTo(1000 - K_FACTOR * 0.5)
  })

  it('is zero-sum (winner gains what loser loses) above the floor', () => {
    const { winner, loser } = applyWin(1000, 1000)
    expect(winner - 1000).toBeCloseTo(1000 - loser)
  })

  it('rewards an upset more than an expected win', () => {
    const upset = applyWin(800, 1200) // weak beats strong
    const expected = applyWin(1200, 800) // strong beats weak
    expect(upset.winner - 800).toBeGreaterThan(expected.winner - 1200)
  })

  it('never lets the loser drop below the floor', () => {
    const { loser } = applyWin(5, MIN_STRENGTH)
    expect(loser).toBeGreaterThanOrEqual(MIN_STRENGTH)
  })

  it('honours a custom K factor', () => {
    const { winner } = applyWin(1000, 1000, 64)
    expect(winner).toBeCloseTo(1000 + 64 * 0.5)
  })
})

describe('applyTie', () => {
  it('does not change equal strengths', () => {
    const { a, b } = applyTie(1000, 1000)
    expect(a).toBeCloseTo(1000)
    expect(b).toBeCloseTo(1000)
  })

  it('pulls the stronger entity down and the weaker up', () => {
    const { a, b } = applyTie(1200, 800)
    expect(a).toBeLessThan(1200)
    expect(b).toBeGreaterThan(800)
  })

  it('moves less than a decisive win (half K factor)', () => {
    const tie = applyTie(1200, 800)
    const win = applyWin(800, 1200)
    // The weaker entity gains more from beating the stronger than from a tie.
    expect(win.winner - 800).toBeGreaterThan(tie.b - 800)
  })

  it('keeps both entities at or above the floor', () => {
    const { a, b } = applyTie(MIN_STRENGTH, 5000)
    expect(a).toBeGreaterThanOrEqual(MIN_STRENGTH)
    expect(b).toBeGreaterThanOrEqual(MIN_STRENGTH)
  })
})

describe('constants', () => {
  it('match the documented defaults', () => {
    expect(INITIAL_RATING).toBe(1000)
    expect(K_FACTOR).toBe(32)
  })
})
