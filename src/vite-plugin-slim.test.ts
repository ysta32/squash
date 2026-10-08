import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  reactRouterProductionEntries,
  slimReactRouter,
  stripLucideIconKeys,
} from '../vite-plugin-slim'

const require = createRequire(import.meta.url)
const lucideIcon = (name: string) =>
  readFileSync(
    join(dirname(require.resolve('lucide-react/package.json')), 'dist/esm/icons', `${name}.mjs`),
    'utf8',
  )

describe('slim bundle transforms', () => {
  it.each(['bug', 'command'])('strips only the React keys from the %s icon', (name) => {
    const source = lucideIcon(name)
    const slim = stripLucideIconKeys(source)
    expect(source).toMatch(/key: "/)
    expect(slim).not.toMatch(/\bkey:/)
    expect(slim).not.toMatch(/^__iconData\.node;/m)
    expect(slim.match(/\bd: "[^"]+"/g)).toEqual(source.match(/\bd: "[^"]+"/g))
    expect(slim).toContain(`name: "${name}"`)
    expect(slim).toMatch(/createLucideIcon\(__iconData\)/)
  })

  it('marks React factories pure and drops top-level DevTools labels in React Router', () => {
    const source = [
      'var NavigationContext = React.createContext(null);',
      'NavigationContext.displayName = "Navigation";',
      'var Link = React10.forwardRef(function LinkWithRef() {});',
      'var Memo = /* @__PURE__ */ React3.memo(Inner);',
      'function f() {',
      '  Inner.displayName = "kept";',
      '}',
      '',
    ].join('\n')
    expect(slimReactRouter(source)).toBe(
      [
        'var NavigationContext = /* @__PURE__ */ React.createContext(null);',
        'var Link = /* @__PURE__ */ React10.forwardRef(function LinkWithRef() {});',
        'var Memo = /* @__PURE__ */ React3.memo(Inner);',
        'function f() {',
        '  Inner.displayName = "kept";',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('finds the React Router production build that replaces the development export', () => {
    const { router, dom } = reactRouterProductionEntries()
    expect(router).toMatch(/[\\/]dist[\\/]production[\\/]index\.mjs$/)
    expect(dom).toMatch(/[\\/]dist[\\/]production[\\/]dom-export\.mjs$/)
    expect(existsSync(router) && existsSync(dom)).toBe(true)
    expect(readFileSync(router, 'utf8')).toMatch(/BrowserRouter/)
  })
})

describe('stubbed Supabase clients stay unused', () => {
  const srcDir = dirname(fileURLToPath(import.meta.url))
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === 'test' ? [] : sources(path)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })

  it('app code never reaches supabase.functions or storage.analytics', () => {
    const offenders = sources(srcDir).filter((path) =>
      /\.\s*functions\b|\.\s*analytics\b|@supabase\/functions-js|iceberg-js/.test(
        readFileSync(path, 'utf8'),
      ),
    )
    expect(offenders).toEqual([])
  })
})
