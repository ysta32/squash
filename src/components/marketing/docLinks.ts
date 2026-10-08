import { content } from './content'

export interface DocLink {
  /** `claude` for the Claude Code guide, otherwise the docs/site file name. */
  slug: string
  title: string
  description: string
  group: 'Use' | 'Run'
  path: string
}

const CLAUDE_DOC: DocLink = {
  slug: 'claude',
  title: 'Claude Code',
  description: 'Install the helper, send bugs to Claude Code and follow its progress.',
  group: 'Use',
  path: '/claude',
}

/** Every docs page in reading order: the Markdown pages plus the Claude Code guide after Keyboard. */
export const DOC_LINKS: DocLink[] = (() => {
  const pages: (DocLink & { order: number })[] = content.docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    group: doc.group,
    path: `/docs/${doc.slug}`,
    order: doc.order,
  }))
  const lastUse = Math.max(0, ...pages.filter((p) => p.group === 'Use').map((p) => p.order))
  return [...pages, { ...CLAUDE_DOC, order: lastUse + 0.5 }]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...link }) => link)
})()

export const DOC_GROUPS: { id: 'Use' | 'Run'; title: string }[] = [
  { id: 'Use', title: 'Use Squash' },
  { id: 'Run', title: 'Run your own' },
]
