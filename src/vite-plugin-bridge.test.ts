// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { bridgeConfigPlugin } from '../vite-plugin-bridge'

afterEach(() => vi.unstubAllEnvs())

it.each([
  [undefined, {}],
  ['https://project.supabase.co', { supabaseHost: 'project.supabase.co' }],
  ['https://storage.example.com', { supabaseHost: 'storage.example.com' }],
])('emits public bridge config for %s', async (url, expected) => {
  vi.stubEnv('VITE_SUPABASE_URL', url)
  const root = await mkdtemp(join(tmpdir(), 'squash-bridge-build-'))
  try {
    await writeFile(join(root, 'index.html'), '<html><body>test</body></html>')
    const result = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      plugins: [bridgeConfigPlugin()],
      build: { write: false },
    })
    if (!('output' in result)) throw new Error('Expected one build output')
    const config = result.output.find((asset) => asset.fileName === 'bridge/config.json')
    if (config?.type !== 'asset') throw new Error('Missing bridge config asset')
    expect(JSON.parse(String(config.source))).toEqual(expected)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
