import type { BugFilters } from '../hooks/useBugs'
import type { BugWithMeta } from './types'

export type OnboardingSteps = {
  filed: boolean
  invited: boolean
  claude: boolean
  resolved: boolean
}

/** Checklist progress, from the whole workspace (every kind and status), not the current view. */
export function onboardingSteps(
  bugs: BugWithMeta[],
  memberCount: number,
  claudeConnected: boolean,
): OnboardingSteps {
  return {
    filed: bugs.some((b) => !b.optimistic),
    invited: memberCount > 1,
    claude: claudeConnected,
    resolved: bugs.some((b) => b.status === 'resolved'),
  }
}

/**
 * Nothing of this kind has been filed yet and nothing is hidden by a filter or a failed load: the
 * view to show is how to file the first one (the list on phones, the detail pane on desktop).
 */
export function isFirstItemView(view: {
  loading: boolean
  error: string | null
  /** Items of every kind loaded. */
  total: number
  /** Items of the current kind, any status. */
  kindTotal: number
  visible: number
  filtered: boolean
  tab: BugFilters['tab']
}): boolean {
  return (
    !view.loading &&
    !(view.error && view.total === 0) &&
    view.visible === 0 &&
    !view.filtered &&
    view.kindTotal === 0 &&
    view.tab !== 'resolved'
  )
}
