import { describe, expect, it } from 'vitest'

const scriptPath = '../../scripts/size-check.mjs'
const { checkBudgets, BUDGET_ENTRY_KB, BUDGET_TOTAL_KB } = (await import(scriptPath)) as {
  checkBudgets: (entryBytes: number, totalJsBytes: number) => string[]
  BUDGET_ENTRY_KB: number
  BUDGET_TOTAL_KB: number
}

describe('bundle size budgets', () => {
  it('accepts sizes below the budgets', () => {
    expect(checkBudgets(71944, 173185)).toEqual([])
  })

  it('accepts sizes exactly at both budgets', () => {
    expect(checkBudgets(BUDGET_ENTRY_KB * 1000, BUDGET_TOTAL_KB * 1000)).toEqual([])
  })

  it('rejects an entry one byte over budget even when total JS is under budget', () => {
    expect(checkBudgets(BUDGET_ENTRY_KB * 1000 + 1, 190000)).toEqual([
      `Entry gzip size exceeds ${BUDGET_ENTRY_KB} kB`,
    ])
  })

  it('rejects total JS one byte over budget even when the entry is under budget', () => {
    expect(checkBudgets(70000, BUDGET_TOTAL_KB * 1000 + 1)).toEqual([
      `Total JS gzip size exceeds ${BUDGET_TOTAL_KB} kB`,
    ])
  })

  it('reports both exceeded budgets', () => {
    expect(checkBudgets(BUDGET_ENTRY_KB * 1000 + 1, BUDGET_TOTAL_KB * 1000 + 1)).toEqual([
      `Entry gzip size exceeds ${BUDGET_ENTRY_KB} kB`,
      `Total JS gzip size exceeds ${BUDGET_TOTAL_KB} kB`,
    ])
  })
})
