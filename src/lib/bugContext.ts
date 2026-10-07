export type BugContext = {
  url?: string
  viewport?: { w: number; h: number; dpr?: number }
  browser?: string
  os?: string
  build?: string
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeContext(value: unknown): BugContext {
  if (!object(value)) return {}
  const result: BugContext = {}
  for (const key of ['browser', 'os', 'build'] as const) {
    if (typeof value[key] === 'string') {
      const text = value[key]
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
        .join('')
        // C1 controls and invisible bidi/line-separator characters could reorder the label.
        .replace(/[\u0080-\u009f\u200e\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069]/g, '')
        .trim()
        .slice(0, 128)
      if (text) result[key] = text
    }
  }
  if (typeof value.url === 'string') {
    try {
      const url = new URL(value.url.trim().slice(0, 2048))
      if (url.protocol === 'http:' || url.protocol === 'https:')
        result.url = url.href.slice(0, 2048)
    } catch {
      // Malformed URLs are omitted from captured metadata.
    }
  }
  const viewport = value.viewport
  const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
  if (object(viewport) && positive(viewport.w) && positive(viewport.h)) {
    result.viewport = {
      w: Math.max(1, Math.min(100000, Math.round(viewport.w))),
      h: Math.max(1, Math.min(100000, Math.round(viewport.h))),
    }
    if (positive(viewport.dpr))
      result.viewport.dpr = Math.round(Math.min(16, viewport.dpr) * 100) / 100
  }
  return result
}

export function extractUrl(text: string): string | undefined {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    let candidate = match[0]
    for (let previous = ''; previous !== candidate;) {
      previous = candidate
      candidate = candidate.replace(/[.,;:!?]+$/, '').replace(/[\]}]+$/, '')
      if (
        candidate.endsWith(')') &&
        (candidate.match(/\)/g)?.length ?? 0) > (candidate.match(/\(/g)?.length ?? 0)
      )
        candidate = candidate.slice(0, -1)
    }
    const url = sanitizeContext({ url: candidate }).url
    if (url && (typeof window === 'undefined' || new URL(url).origin !== window.location.origin))
      return url
  }
  return undefined
}

export function collectEnvContext(): BugContext {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {}
  const ua = navigator.userAgent
  const data = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string }
    }
  ).userAgentData
  const browserMatch =
    /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/.exec(ua) ??
    /(?:Firefox|FxiOS)\/([\d.]+)/.exec(ua) ??
    /(?:Chrome|CriOS)\/([\d.]+)/.exec(ua) ??
    /Version\/([\d.]+).*Safari/.exec(ua)
  const brand = data?.brands?.find((b) => /^(Google Chrome|Microsoft Edge|Chromium)$/.test(b.brand))
  const browser = browserMatch
    ? `${/Edg/.test(browserMatch[0]) ? 'Edge' : /Firefox|FxiOS/.test(browserMatch[0]) ? 'Firefox' : /Chrome|CriOS/.test(browserMatch[0]) ? 'Chrome' : 'Safari'} ${browserMatch[1].split('.')[0]}`
    : brand
      ? `${brand.brand} ${brand.version}`
      : undefined
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : data?.platform
  return sanitizeContext({
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    browser,
    os,
  })
}

export function formatContext(value: unknown): string {
  const context = sanitizeContext(value)
  const v = context.viewport
  return [
    context.url,
    v && `${v.w}×${v.h}${v.dpr ? ` @${v.dpr}x` : ''}`,
    context.browser,
    context.os,
    context.build,
  ]
    .filter(Boolean)
    .join(' · ')
}
