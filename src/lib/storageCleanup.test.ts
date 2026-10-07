import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeScreenshots } from './storageCleanup'

const list = vi.hoisted(() => vi.fn())
const remove = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({ list, remove }) } },
}))

const file = (name: string) => ({ id: `id-${name}`, name })
const folder = (name: string) => ({ id: null, name })

describe('removeScreenshots', () => {
  beforeEach(() => {
    list.mockReset()
    remove.mockReset()
    remove.mockResolvedValue({ error: null })
  })

  it('recurses into folders and removes full paths', async () => {
    list.mockImplementation((prefix: string) => {
      if (prefix === 'ws')
        return Promise.resolve({ data: [folder('bug1'), file('x.webp')], error: null })
      if (prefix === 'ws/bug1') return Promise.resolve({ data: [file('a.webp')], error: null })
      return Promise.resolve({ data: [], error: null })
    })
    await removeScreenshots('ws')
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove.mock.calls[0][0].sort()).toEqual(['ws/bug1/a.webp', 'ws/x.webp'])
  })

  it('paginates listings and batches removals by 100', async () => {
    const page = (start: number, n: number) =>
      Array.from({ length: n }, (_, i) => file(`f${start + i}`))
    list.mockImplementation((_p: string, opts: { offset: number }) =>
      Promise.resolve({
        data: opts.offset === 0 ? page(0, 100) : opts.offset === 100 ? page(100, 50) : [],
        error: null,
      }),
    )
    await removeScreenshots('ws')
    expect(list).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove.mock.calls[0][0]).toHaveLength(100)
    expect(remove.mock.calls[1][0]).toHaveLength(50)
    expect(remove.mock.calls[1][0][0]).toBe('ws/f100')
  })

  it('does not call remove when nothing is stored', async () => {
    list.mockResolvedValue({ data: [], error: null })
    await removeScreenshots('ws')
    expect(remove).not.toHaveBeenCalled()
  })

  it('throws on list error and on remove error', async () => {
    list.mockResolvedValueOnce({ data: null, error: { message: 'list boom' } })
    await expect(removeScreenshots('ws')).rejects.toThrow('list boom')

    list.mockResolvedValue({ data: [file('a')], error: null })
    remove.mockResolvedValue({ error: { message: 'rm boom' } })
    await expect(removeScreenshots('ws')).rejects.toThrow('rm boom')
  })

  it('throws when listing returns no data', async () => {
    list.mockResolvedValue({ data: null, error: null })
    await expect(removeScreenshots('ws')).rejects.toThrow('Could not list screenshots.')
  })
})
