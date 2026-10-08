import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

/*
 * Build-only bundle trims. Each one keeps runtime behaviour and only drops bytes the app never
 * executes in production; dev and vitest load the packages untouched.
 */

const LUCIDE_ICON = /[\\/]lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/][^\\/]+\.mjs$/
const ROUTER_PROD_CHUNK = /[\\/]react-router[\\/]dist[\\/]production[\\/]chunk-[^\\/]+\.mjs$/

/**
 * Lucide icon data carries a React key per SVG child plus a bare `__iconData.node;` read. Icons
 * render a fixed child list, so production reconciliation is identical without the keys (React
 * only warns about missing keys in development, where this transform does not run).
 */
export function stripLucideIconKeys(code: string): string {
  return code.replace(/,\s*key: "[^"]*"/g, '').replace(/^__iconData\.node;\r?\n/m, '')
}

/**
 * React Router's production chunk builds every context and forwardRef component at module scope
 * and tags each with a DevTools `displayName`, so the bundler keeps the unused ones (Form, NavLink,
 * ScrollRestoration, data-router contexts). Marking the factories pure and dropping the top-level
 * DevTools labels lets tree shaking remove what the app does not import.
 */
export function slimReactRouter(code: string): string {
  return code
    .replace(/^[\w$]+\.displayName = "[^"]*";\r?\n/gm, '')
    .replace(
      /(?<!@__PURE__ \*\/ )\b(React\d*\.(?:forwardRef|createContext|memo)\()/g,
      '/* @__PURE__ */ $1',
    )
}

/** The production build of React Router; the package exports only its development build. */
export function reactRouterProductionEntries(): { router: string; dom: string } {
  const pkg = createRequire(import.meta.url).resolve('react-router/package.json')
  const prodDir = join(dirname(pkg), 'dist', 'production')
  const router = join(prodDir, 'index.mjs')
  const dom = join(prodDir, 'dom-export.mjs')
  if (!existsSync(router) || !existsSync(dom)) {
    throw new Error(`React Router production build not found in ${prodDir}`)
  }
  return { router, dom }
}

/**
 * The app never calls `supabase.functions` or `supabase.storage.analytics`; these stand-ins replace
 * the Edge Functions client and the Iceberg catalog behind them and fail loudly if either is used.
 */
const UNUSED_SUPABASE_STUBS: Record<string, string> = {
  '@supabase/functions-js': `
const unavailable = () => {
  throw new Error('supabase.functions is not bundled; remove its stub in vite-plugin-slim.ts to use it')
}
export class FunctionsClient { constructor() { unavailable() } }
export class FunctionsError extends Error {}
export class FunctionsFetchError extends FunctionsError {}
export class FunctionsHttpError extends FunctionsError {}
export class FunctionsRelayError extends FunctionsError {}
export const FunctionRegion = Object.freeze({})
`,
  'iceberg-js': `
export class IcebergRestCatalog {
  constructor() {
    throw new Error('supabase.storage.analytics is not bundled; remove its stub in vite-plugin-slim.ts to use it')
  }
}
`,
}
const STUB_PREFIX = '\0squash-unused:'

/**
 * React ships CommonJS, so every compiled JSX call reaches the runtime through an interop property
 * read (`(0, r.jsx)(...)`). Re-exporting the three bindings from an ES module lets each call site
 * use a plain local binding instead; the functions are the same objects.
 */
const JSX_RUNTIME = '\0squash-jsx-runtime'
const JSX_RUNTIME_SOURCE = `import * as runtime from 'react/jsx-runtime'
export const Fragment = runtime.Fragment
export const jsx = runtime.jsx
export const jsxs = runtime.jsxs
`

export function slimBundlePlugin(): Plugin {
  let router: { router: string; dom: string } | undefined
  return {
    name: 'squash-slim-bundle',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      router = reactRouterProductionEntries()
    },
    resolveId(id, importer) {
      if (id === 'react/jsx-runtime' && importer !== JSX_RUNTIME) return JSX_RUNTIME
      if (id === 'react-router' && router) return router.router
      if (id === 'react-router/dom' && router) return router.dom
      if (
        Object.hasOwn(UNUSED_SUPABASE_STUBS, id) &&
        importer &&
        /[\\/]@supabase[\\/]/.test(importer)
      ) {
        return STUB_PREFIX + id
      }
      return null
    },
    load(id) {
      if (id === JSX_RUNTIME) return JSX_RUNTIME_SOURCE
      if (id.startsWith(STUB_PREFIX)) return UNUSED_SUPABASE_STUBS[id.slice(STUB_PREFIX.length)]
      return null
    },
    transform(code, id) {
      if (LUCIDE_ICON.test(id)) return { code: stripLucideIconKeys(code), map: null }
      if (ROUTER_PROD_CHUNK.test(id)) return { code: slimReactRouter(code), map: null }
      return null
    },
  }
}
