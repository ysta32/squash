// Runs the real app with src/lib/supabase.ts swapped for an in-memory mock (see mock-supabase.ts).
// Used by capture.mjs; start it alone with:
//   npx vite --config scripts/screenshots/vite.config.ts
import { createReadStream, existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, searchForWorkspaceRoot, type Plugin } from 'vite'
import base from '../../vite.config'

const root = fileURLToPath(new URL('../..', import.meta.url))
const realClient = fileURLToPath(new URL('../../src/lib/supabase.ts', import.meta.url))
const mockClient = fileURLToPath(new URL('./mock-supabase.ts', import.meta.url))
export const fixturesDir = fileURLToPath(
  new URL('../../node_modules/.cache/squash-shots/', import.meta.url),
)

function mockSupabase(): Plugin {
  return {
    name: 'squash-mock-supabase',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('supabase') || importer === mockClient) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === realClient ? mockClient : null
    },
    configureServer(server) {
      server.middlewares.use('/__shots/', (req, res, next) => {
        const file = fixturesDir + (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (!existsSync(file)) return next()
        res.setHeader('Content-Type', 'image/png')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default mergeConfig(
  base,
  defineConfig({
    root,
    plugins: [mockSupabase()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://demo.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('demo'),
      'import.meta.env.VITE_GITHUB_URL': JSON.stringify('https://github.com/ysta32/squash'),
      'import.meta.env.VITE_SITE_URL': JSON.stringify('http://localhost:5174'),
    },
    server: {
      port: 5174,
      strictPort: true,
      // Self-hosted fonts load from node_modules, which may be a symlink outside the root
      // (git worktrees share one install).
      fs: { allow: [searchForWorkspaceRoot(root), realpathSync(`${root}/node_modules`)] },
    },
  }),
)
