import type { Plugin } from 'vite'

export function bridgeConfigPlugin(): Plugin {
  let source = '{}'

  return {
    name: 'squash-bridge-config',
    configResolved(config) {
      const url: unknown = config.env.VITE_SUPABASE_URL
      source = JSON.stringify(url ? { supabaseHost: new URL(String(url)).hostname } : {})
    },
    configureServer(server) {
      server.middlewares.use('/bridge/config.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(source)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'bridge/config.json', source })
    },
  }
}
