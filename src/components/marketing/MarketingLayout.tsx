import { Menu, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { facts } from './facts'
import { useAuth } from '../../lib/auth'
import { cn } from '../../lib/utils'
import { SkipLink } from '../SkipLink'
import { Logo, buttonClass } from '../ui'
import { FOOTER_COLUMNS, NAV_LINKS, resolveHref, type MarketingLink } from './links'
import './marketing.css'

/** Shared page width for every marketing page: 12 columns inside, generous gutters outside. */
export const MK_CONTAINER = 'mx-auto w-full max-w-[84rem] px-5 sm:px-8 lg:px-12'

function SiteLink({
  link,
  className,
  onClick,
}: {
  link: MarketingLink
  className?: string
  onClick?: () => void
}) {
  const { href, external } = resolveHref(link.to)
  const { pathname } = useLocation()
  if (external) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {link.label}
      </a>
    )
  }
  return (
    <Link
      to={href}
      aria-current={isCurrent(href, pathname) ? 'page' : undefined}
      className={className}
      onClick={onClick}
    >
      {link.label}
    </Link>
  )
}

/**
 * The link for the page being shown: an exact match, or its section (Docs on /docs/capture),
 * unless a more specific link exists for that exact page (Self-host on /docs/self-host).
 */
function isCurrent(href: string, pathname: string): boolean {
  if (href === pathname) return true
  if (href === '/' || !pathname.startsWith(`${href}/`)) return false
  return !NAV_LINKS.some((link) => link.to === pathname)
}

function useScrolled(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])
  return scrolled
}

/** "Open a workspace": sign in first when signed out, straight to the app when signed in. */
export function OpenWorkspaceLink({
  size = 'md',
  className,
}: {
  size?: 'md' | 'lg'
  className?: string
}) {
  const { user } = useAuth()
  return (
    <Link to={user ? '/app' : '/signin'} className={buttonClass('primary', size, className)}>
      Open a workspace
    </Link>
  )
}

function Header() {
  const scrolled = useScrolled()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { key } = useLocation()

  // Navigating (including to an in-page anchor, or Back) closes the phone menu.
  const [seenKey, setSeenKey] = useState(key)
  if (seenKey !== key) {
    setSeenKey(key)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const navLink =
    't focus-ring rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-surface-3/60 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:bg-surface-3/60'

  return (
    <header
      className={cn(
        't glass sticky top-0 z-40 border-b',
        scrolled || open ? 'border-line' : 'border-transparent',
      )}
    >
      <div className={cn(MK_CONTAINER, 'flex h-16 items-center justify-between gap-6')}>
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="Squash home" className="focus-ring -m-1 rounded-md p-1">
            <Logo className="text-base" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <SiteLink key={link.label} link={link} className={navLink} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <OpenWorkspaceLink className="max-sm:h-11" />
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
            className="t focus-ring inline-flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3/60 hover:text-ink lg:hidden"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id={menuId}
        aria-label="Main navigation"
        hidden={!open}
        className="border-t border-line lg:hidden"
      >
        <ul className={cn(MK_CONTAINER, 'py-2')}>
          {NAV_LINKS.map((link) => (
            <li key={link.label} className="border-b border-line last:border-b-0">
              <SiteLink
                link={link}
                onClick={() => setOpen(false)}
                className="t focus-ring-inset flex h-12 items-center text-base text-ink hover:text-accent aria-[current=page]:text-accent"
              />
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

function Footer() {
  const footLink =
    't focus-ring inline-flex min-h-8 items-center rounded-sm text-sm text-ink-2 hover:text-ink max-sm:min-h-11'
  return (
    <footer className="border-t border-line">
      <div className={cn(MK_CONTAINER, 'grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24')}>
        <div className="lg:col-span-4">
          <Link
            to="/"
            aria-label="Squash home"
            className="focus-ring -m-1 inline-flex rounded-md p-1"
          >
            <Logo size={20} className="text-sm" />
          </Link>
          <p className="mt-4 max-w-[30ch] text-sm leading-6 text-ink-2">
            A bug tracker for teams of 2–10 people. Open source, self-hostable on Supabase.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8"
        >
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="specimen-label text-ink-3">{column.title}</h2>
              <ul className="mt-4 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <SiteLink link={link} className={footLink} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={MK_CONTAINER}>
        <p className="specimen-label flex flex-wrap gap-x-3 gap-y-1 border-t border-line py-6 text-ink-3">
          <span>
            {facts.license} license · {facts.latestRelease.version}
          </span>
          <span aria-hidden="true" className="max-sm:hidden">
            ·
          </span>
          <span>© {new Date().getFullYear()} Squash contributors</span>
        </p>
      </div>
    </footer>
  )
}

/** Shell for every public page: skip link, sticky glass nav, one `#main`, sitemap footer. */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip text-ink">
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  )
}
