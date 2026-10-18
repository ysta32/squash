import { Link } from 'react-router-dom'
import type { ClaudeLimitWindow, ClaudeUsage } from '../../lib/claudeExport'
import { formatTokens, formatUsd, usageByBug } from '../../lib/claudeUsage'
import { cn } from '../../lib/utils'
import { proseLinkClass } from '../ui'
import { LedgerGroup, LedgerRow } from './Ledger'

/** Items listed under "By item", most used first. */
const TOP_ITEMS = 8

function resetsIn(iso: string | null, now: Date): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return ' · has reset since'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.round((ms % 3_600_000) / 60_000)
  if (hours >= 24) {
    const day = new Date(iso).toLocaleDateString([], { weekday: 'short', hour: 'numeric' })
    return ` · resets ${day}`
  }
  return ` · resets in ${hours > 0 ? `${hours}h ` : ''}${minutes}m`
}

function Meter({
  label,
  window,
  now,
}: {
  label: string
  window: ClaudeLimitWindow | null
  now: Date
}) {
  if (!window) return null
  const used = window.usedPercent
  const left = Math.max(0, Math.round((100 - used) * 10) / 10)
  const tone = used >= 90 ? 'bg-danger' : used >= 75 ? 'bg-warning' : 'bg-accent'
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-xs text-ink-2 nums">
          {left}% left
          <span className="text-ink-3">{resetsIn(window.resetsAt, now)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
        aria-valuetext={`${used}% used, ${left}% left`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${used}%` }} />
      </div>
    </div>
  )
}

/**
 * What Claude Code has used for this workspace on this computer (tokens and API-price cost, in
 * total and per item) and how much of the Claude plan's limits is left.
 */
export function ClaudeUsagePanel({
  workspaceId,
  usage,
  outdated,
  now = new Date(),
}: {
  workspaceId: string
  usage: ClaudeUsage | null
  /** The helper runs but is older than v13, so it records no usage. */
  outdated: boolean
  now?: Date
}) {
  if (outdated) {
    return (
      <LedgerGroup title="Usage">
        <LedgerRow
          label="Claude usage"
          description="Update the helper (v13) to see how much each run, item and this project uses, and how much of your plan is left."
        />
      </LedgerGroup>
    )
  }
  if (!usage) return null
  const { limits, total } = usage
  const items = [...usageByBug(usage.runs.filter((r) => r.kind === 'fix'))]
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .slice(0, TOP_ITEMS)
  const questions = usage.runs.filter((r) => r.kind === 'question')

  return (
    <LedgerGroup title="Usage" meta="this computer">
      <LedgerRow
        label="Plan left"
        stack
        description={
          limits
            ? `Your Claude plan’s limits as of the last run, ${new Date(limits.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. They count everything you use Claude for, not just Squash.`
            : 'Shows after the next run when Claude Code is signed in with a Claude subscription (API keys have no plan limits).'
        }
      >
        {limits && (
          <div className="grid max-w-md gap-4">
            <Meter label="5-hour window" window={limits.fiveHour} now={now} />
            <Meter label="Weekly" window={limits.sevenDay} now={now} />
            {limits.status === 'rejected' && (
              <p role="alert" className="text-sm text-danger">
                Limit reached: runs wait until it resets.
              </p>
            )}
          </div>
        )}
      </LedgerRow>
      <LedgerRow
        label="This project"
        description={
          total.runs === 0
            ? 'Nothing yet. Each Claude Code run adds what it used once it finishes.'
            : `${total.runs} ${total.runs === 1 ? 'run' : 'runs'} · ${formatTokens(total.tokens)} tokens (${formatTokens(total.output)} written, ${formatTokens(total.cacheRead)} re-read from cache) · ${formatUsd(total.costUsd)} at API prices`
        }
      />
      {items.length > 0 && (
        <LedgerRow
          label="By item"
          stack
          description="Runs sent with several items are split evenly between them."
        >
          <table className="w-full max-w-md text-sm">
            <thead className="sr-only">
              <tr>
                <th>Item</th>
                <th>Runs</th>
                <th>Tokens</th>
                <th>Cost at API prices</th>
              </tr>
            </thead>
            <tbody>
              {items.map(([number, item]) => (
                <tr key={number} className="border-b border-line last:border-b-0">
                  <td className="py-1.5">
                    <Link
                      to={`/app/${workspaceId}/bug/${number}`}
                      className={cn(proseLinkClass, 'font-mono')}
                    >
                      #{number}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink-3 nums">
                    {item.runs} {item.runs === 1 ? 'run' : 'runs'}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink nums">
                    {formatTokens(item.tokens)}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink-2 nums">
                    {formatUsd(item.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </LedgerRow>
      )}
      {questions.length > 0 && (
        <LedgerRow
          label="Questions"
          description={`${questions.length} asked · ${formatTokens(questions.reduce((n, q) => n + q.tokens, 0))} tokens · ${formatUsd(questions.reduce((n, q) => n + q.costUsd, 0))} at API prices`}
        />
      )}
    </LedgerGroup>
  )
}
