import { useCallback, useId, useRef, useState } from 'react'
import { ChevronDown, Download, X } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss'
import type { BugFilters as Filters } from '../hooks/useBugs'
import { bugsToCsv, bugsToMarkdown, downloadText, exportFilename } from '../lib/export'
import { SEVERITIES, SEVERITY_LABEL } from '../lib/types'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { Button, inputClass } from './ui'

export interface BugFiltersProps {
  filters: Filters
  onFilters: (filters: Filters) => void
  members: WorkspaceMember[]
  selfId?: string
  bugs?: BugWithMeta[]
  workspaceName?: string
  onExport?: (format: 'csv' | 'md') => void
}

const selectClass = `${inputClass} h-auto w-auto max-w-40 appearance-none py-1.5 pl-2 pr-7 text-xs text-muted hover:text-fg`

export function BugFilters({
  filters,
  onFilters,
  members,
  selfId,
  bugs = [],
  workspaceName,
  onExport,
}: BugFiltersProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const closeExport = useCallback(() => setExportOpen(false), [])
  useDismiss(exportRef, closeExport, exportOpen)
  const active =
    filters.filedBy || filters.resolvedBy || filters.assignee || filters.severity || filters.query
  const self = selfId ? members.find((member) => member.user_id === selfId) : undefined

  function exportBugs(format: 'csv' | 'md'): void {
    closeExport()
    triggerRef.current?.focus()
    if (onExport) {
      onExport(format)
    } else if (workspaceName !== undefined) {
      downloadText(
        exportFilename(workspaceName, format),
        format === 'csv' ? bugsToCsv(bugs) : bugsToMarkdown(bugs, workspaceName),
        format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
      )
    }
  }

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
          aria-label="Assignee"
          title="Assignee"
          className={selectClass}
          value={filters.assignee ?? ''}
          onChange={(event) => onFilters({ ...filters, assignee: event.target.value || null })}
        >
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {self && <option value={self.user_id}>Me</option>}
          {members
            .filter((member) => member !== self)
            .map((member) => (
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onFilters({
              ...filters,
              filedBy: null,
              resolvedBy: null,
              assignee: null,
              severity: null,
              query: '',
            })
          }
        >
          <X size={12} aria-hidden="true" /> Clear
        </Button>
      )}
      <div ref={exportRef} className="relative">
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          aria-controls={exportOpen ? menuId : undefined}
          onClick={() => setExportOpen((open) => !open)}
        >
          <Download size={14} aria-hidden="true" /> Export
        </Button>
        {exportOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label="Export bugs"
            className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated"
            onKeyDown={(event) => {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
              )
              const index = items.indexOf(document.activeElement as HTMLButtonElement)
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                items[next]?.focus()
              } else if (event.key === 'Escape') {
                triggerRef.current?.focus()
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) closeExport()
            }}
          >
            {(['csv', 'md'] as const).map((format, index) => (
              <Button
                key={format}
                autoFocus={index === 0}
                role="menuitem"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => exportBugs(format)}
              >
                {format === 'csv' ? 'CSV' : 'Markdown'}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
