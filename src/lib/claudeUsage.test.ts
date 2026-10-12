import { describe, expect, it } from 'vitest'
import type { ClaudeUsageRun } from './claudeExport'
import { formatTokens, formatUsd, usageByBug } from './claudeUsage'

const run = (bugs: number[], tokens: number, costUsd: number): ClaudeUsageRun => ({
  id: String(Math.random()),
  kind: 'fix',
  bugs,
  finishedAt: null,
  tokens,
  costUsd,
  turns: 1,
  durationMs: 1,
  models: [],
})

describe('usageByBug', () => {
  it('adds up each item and splits shared runs evenly', () => {
    const byBug = usageByBug([run([1], 1000, 1), run([1, 2], 500, 0.5)])
    expect(byBug.get(1)).toEqual({ tokens: 1250, costUsd: 1.25, runs: 2 })
    expect(byBug.get(2)).toEqual({ tokens: 250, costUsd: 0.25, runs: 1 })
    expect(byBug.has(3)).toBe(false)
  })
})

describe('formatting', () => {
  it('shortens token counts', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(12_400)).toBe('12K')
    expect(formatTokens(1_500)).toBe('1.5K')
    expect(formatTokens(2_628_828)).toBe('2.6M')
  })

  it('shows dollars to the cent', () => {
    expect(formatUsd(1.38151)).toBe('$1.38')
    expect(formatUsd(0.004)).toBe('<$0.01')
    expect(formatUsd(0)).toBe('$0.00')
  })
})
