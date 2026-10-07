import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SEVERITIES, type Severity } from '../lib/types'
import type { BugFilters } from './useBugs'

export const DEFAULT_FILTERS: BugFilters = {
  kind: 'bug',
  tab: 'open',
  filedBy: null,
  resolvedBy: null,
  assignee: null,
  severity: null,
  query: '',
}

const KEYS = ['kind', 'status', 'by', 'resolver', 'assignee', 'sev', 'q']

function orNull(v: string | null): string | null {
  return v ? v : null
}

export function parseFilters(params: URLSearchParams): BugFilters {
  const status = params.get('status')
  const sev = params.get('sev')
  return {
    kind: params.get('kind') === 'feature' ? 'feature' : DEFAULT_FILTERS.kind,
    tab: status === 'resolved' || status === 'all' ? status : DEFAULT_FILTERS.tab,
    filedBy: orNull(params.get('by')),
    resolvedBy: orNull(params.get('resolver')),
    assignee: orNull(params.get('assignee')),
    severity: SEVERITIES.includes(sev as Severity) ? (sev as Severity) : null,
    query: params.get('q') ?? '',
  }
}

/** Writes the non-default filters onto `base`, leaving unrelated params alone. */
export function writeFilters(base: URLSearchParams, f: BugFilters): URLSearchParams {
  const out = new URLSearchParams(base)
  for (const k of KEYS) out.delete(k)
  if (f.kind !== DEFAULT_FILTERS.kind) out.set('kind', f.kind)
  if (f.tab !== DEFAULT_FILTERS.tab) out.set('status', f.tab)
  if (f.filedBy) out.set('by', f.filedBy)
  if (f.resolvedBy) out.set('resolver', f.resolvedBy)
  if (f.assignee) out.set('assignee', f.assignee)
  if (f.severity) out.set('sev', f.severity)
  if (f.query) out.set('q', f.query)
  return out
}

/** The list filters, kept in the URL query so a view can be shared and Back restores it. */
export function useUrlFilters(): [
  BugFilters,
  (next: BugFilters | ((f: BugFilters) => BugFilters)) => void,
] {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const latest = useRef(filters)
  useEffect(() => {
    latest.current = filters
  }, [filters])

  const setFilters = useCallback(
    (next: BugFilters | ((f: BugFilters) => BugFilters)) => {
      const prev = latest.current
      const value = typeof next === 'function' ? next(prev) : next
      const typingOnly = value.query !== prev.query && value.query !== '' && prev.query !== ''
      const sameElsewhere =
        JSON.stringify({ ...value, query: '' }) === JSON.stringify({ ...prev, query: '' })
      latest.current = value
      setParams((p) => writeFilters(p, value), { replace: typingOnly && sameElsewhere })
    },
    [setParams],
  )

  return [filters, setFilters]
}
