import { ChevronDown, X } from 'lucide-react'
import type { BugFilters as Filters } from '../hooks/useBugs'
import { SEVERITIES, SEVERITY_LABEL } from '../lib/types'
import type { WorkspaceMember } from '../lib/types'

export interface BugFiltersProps {
  filters: Filters
  onFilters: (filters: Filters) => void
  members: WorkspaceMember[]
}

const selectClass =
  't max-w-40 appearance-none rounded-md border border-border bg-bg py-1.5 pl-2 pr-7 text-xs text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent'

export function BugFilters({ filters, onFilters, members }: BugFiltersProps) {
  const active = filters.filedBy || filters.resolvedBy || filters.severity || filters.query

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['filedBy', 'resolvedBy'] as const).map((field) => (
        <label key={field} className="relative">
          <select
            aria-label={field === 'filedBy' ? 'Filed by' : 'Resolved by'}
            className={selectClass}
            value={filters[field] ?? ''}
            onChange={(event) => onFilters({ ...filters, [field]: event.target.value || null })}
          >
            <option value="">{field === 'filedBy' ? 'Filed by' : 'Resolved by'}</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile.display_name}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={12}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
          />
        </label>
      ))}
      <label className="relative">
        <select
          aria-label="Severity"
          className={selectClass}
          value={filters.severity ?? ''}
          onChange={(event) =>
            onFilters({
              ...filters,
              severity: SEVERITIES.find((severity) => severity === event.target.value) ?? null,
            })
          }
        >
          <option value="">Severity</option>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABEL[severity]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
        />
      </label>
      {active && (
        <button
          type="button"
          className="t inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() =>
            onFilters({ ...filters, filedBy: null, resolvedBy: null, severity: null, query: '' })
          }
        >
          <X size={12} aria-hidden="true" /> Clear
        </button>
      )}
    </div>
  )
}
