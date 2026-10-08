// Marketing site map (DESIGN.md section 6). Routes listed here that do not exist yet render the 404
// page until their task lands; keep this the single source for nav and footer links.

export const DEFAULT_GITHUB_URL = 'https://github.com/ysta32/squash'

/** The repository URL, overridable per deployment for forks (VITE_GITHUB_URL). */
export function githubUrl(): string {
  const configured: string | undefined = import.meta.env.VITE_GITHUB_URL
  return configured?.trim().replace(/\/+$/, '') || DEFAULT_GITHUB_URL
}

export interface MarketingLink {
  label: string
  /** In-app route (starts with `/`) or a path under the GitHub repository (starts with `github:`). */
  to: string
}

export function resolveHref(to: string): { href: string; external: boolean } {
  if (to.startsWith('github:')) {
    const path = to.slice('github:'.length)
    return { href: `${githubUrl()}${path}`, external: true }
  }
  return { href: to, external: false }
}

export const NAV_LINKS: MarketingLink[] = [
  { label: 'Features', to: '/#features' },
  { label: 'Changelog', to: '/changelog' },
  { label: 'Docs', to: '/docs' },
  { label: 'Self-host', to: '/#self-host' },
  { label: 'GitHub', to: 'github:' },
]

export const FOOTER_COLUMNS: { title: string; links: MarketingLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/#features' },
      { label: 'Changelog', to: '/changelog' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Status', to: '/status' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', to: '/docs' },
      { label: 'Self-host', to: '/#self-host' },
      { label: 'Claude Code guide', to: '/claude' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Press kit', to: '/press' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'About', to: '/about' },
      { label: 'GitHub', to: 'github:' },
      { label: 'License', to: 'github:/blob/main/LICENSE' },
      { label: 'Security policy', to: 'github:/blob/main/SECURITY.md' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
]
