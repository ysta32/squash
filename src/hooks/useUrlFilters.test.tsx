import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { DEFAULT_FILTERS, useUrlFilters } from './useUrlFilters'

afterEach(cleanup)

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => {
      const [filters, setFilters] = useUrlFilters()
      const loc = useLocation()
      return { filters, setFilters, search: loc.search, type: useNavigationType() }
    },
    { wrapper },
  )
}

it('round-trips every field through the URL', () => {
  const { result } = setup('/app/w')
  const full = {
    kind: 'feature' as const,
    tab: 'resolved' as const,
    filedBy: 'u1',
    resolvedBy: 'u2',
    assignee: 'none',
    severity: 'high' as const,
    query: 'dark mode',
  }
  act(() => result.current.setFilters(full))
  const search = result.current.search
  expect(search).toContain('kind=feature')
  expect(search).toContain('status=resolved')
  expect(search).toContain('by=u1')
  expect(search).toContain('resolver=u2')
  expect(search).toContain('assignee=none')
  expect(search).toContain('sev=high')
  expect(search).toContain('q=dark+mode')
  const again = setup(`/app/w${search}`)
  expect(again.result.current.filters).toEqual(full)
})

it('omits defaults so a clean URL stays clean', () => {
  const { result } = setup('/app/w?kind=feature&q=x')
  act(() => result.current.setFilters(DEFAULT_FILTERS))
  expect(result.current.search).toBe('')
})

it('ignores junk values and falls back to the defaults', () => {
  const { result } = setup('/app/w?kind=nope&status=weird&sev=extreme&by=&assignee=')
  expect(result.current.filters).toEqual(DEFAULT_FILTERS)
})

it('supports the functional updater', () => {
  const { result } = setup('/app/w?by=u1')
  act(() => result.current.setFilters((f) => ({ ...f, assignee: 'me' })))
  expect(result.current.filters).toMatchObject({ filedBy: 'u1', assignee: 'me' })
})

it('replaces history while typing a search and pushes other changes', () => {
  const { result } = setup('/app/w')
  act(() => result.current.setFilters((f) => ({ ...f, query: 'a' })))
  expect(result.current.type).toBe('REPLACE')
  act(() => result.current.setFilters((f) => ({ ...f, query: 'ab' })))
  expect(result.current.type).toBe('REPLACE')
  act(() => result.current.setFilters((f) => ({ ...f, tab: 'all' })))
  expect(result.current.type).toBe('PUSH')
  act(() => result.current.setFilters((f) => ({ ...f, tab: 'resolved', query: '' })))
  expect(result.current.type).toBe('PUSH')
})

it('does not navigate for an unchanged update', () => {
  const { result } = setup('/app/w?kind=feature')
  act(() => result.current.setFilters((f) => ({ ...f })))
  expect(result.current.type).toBe('POP')
})
