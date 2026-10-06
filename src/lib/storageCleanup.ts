import { supabase } from './supabase'

/**
 * Removes every object under `<prefix>/` in the screenshots bucket: a workspace id, or
 * `<workspaceId>/<bugId>` for one bug.
 */
export async function removeScreenshots(prefix: string): Promise<void> {
  const bucket = supabase.storage.from('screenshots')
  async function collect(prefix: string): Promise<string[]> {
    const files: string[] = []
    const limit = 100
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await bucket.list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Could not list screenshots.')
      for (const entry of data) {
        const path = `${prefix}/${entry.name}`
        if (entry.id) files.push(path)
        else files.push(...(await collect(path)))
      }
      if (data.length < limit) return files
    }
  }
  const paths = await collect(prefix)
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await bucket.remove(paths.slice(offset, offset + 100))
    if (error) throw new Error(error.message)
  }
}
