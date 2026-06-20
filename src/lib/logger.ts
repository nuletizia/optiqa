/**
 * Minimal level-gated logger.
 *
 * Replaces the ad-hoc `console.log` debugging that used to litter the API routes
 * (and which leaked tokens/PII). Set LOG_LEVEL=debug|info|warn|error (default:
 * "info" in production, "debug" otherwise). Never log secrets or full tokens.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const configuredLevel =
  (process.env.LOG_LEVEL as Level | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const threshold = LEVELS[configuredLevel] ?? LEVELS.info

function emit(level: Level, args: unknown[]) {
  if (LEVELS[level] < threshold) return
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(`[${level}]`, ...args)
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
}
