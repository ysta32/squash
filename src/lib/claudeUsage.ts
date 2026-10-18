import type { ClaudeUsageRun } from './claudeExport'

export interface ItemUsage {
  tokens: number
  costUsd: number
  runs: number
}

/**
 * Usage per item number. A run sent with several items is split evenly between them, so the items
 * add up to the project's total for fix runs.
 */
export function usageByBug(runs: ClaudeUsageRun[]): Map<number, ItemUsage> {
  const byBug = new Map<number, ItemUsage>()
  for (const run of runs) {
    const share = run.bugs.length
    for (const n of run.bugs) {
      const item = byBug.get(n) ?? { tokens: 0, costUsd: 0, runs: 0 }
      item.tokens += run.tokens / share
      item.costUsd += run.costUsd / share
      item.runs++
      byBug.set(n, item)
    }
  }
  return byBug
}

/** "950", "12.4K", "2.6M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const [value, unit] = n < 1e6 ? [n / 1e3, 'K'] : n < 1e9 ? [n / 1e6, 'M'] : [n / 1e9, 'B']
  return `${value < 10 ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value)}${unit}`
}

/** "$1.38", "<$0.01". */
export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}
