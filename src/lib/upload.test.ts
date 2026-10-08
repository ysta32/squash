import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadAttachment } from './upload'
import type { CompressedImage } from '../hooks/useImageCompression'

const upload = vi.hoisted(() => vi.fn())
const removeFn = vi.hoisted(() => vi.fn())
const insert = vi.hoisted(() => vi.fn())
const single = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload, remove: removeFn }) },
    from: () => ({ insert: (row: unknown) => (insert(row), { select: () => ({ single }) }) }),
  },
}))

function image(type: string): CompressedImage {
  return { blob: new Blob(['abcd'], { type }), width: 10, height: 20 } as CompressedImage
}

describe('uploadAttachment', () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ error: null })
    removeFn.mockReset().mockResolvedValue({ error: null })
    insert.mockReset()
    single.mockReset().mockResolvedValue({ data: { id: 'att1' }, error: null })
  })

  it('uploads under workspace/bug path, inserts metadata and reports progress', async () => {
    const onProgress = vi.fn()
    const img = image('image/webp')
    const res = await uploadAttachment({ workspaceId: 'w', bugId: 'b', image: img, onProgress })
    expect(res).toEqual({ id: 'att1' })
    const [path, blob, opts] = upload.mock.calls[0]
    expect(path).toMatch(/^w\/b\/.+\.webp$/)
    expect(blob).toBe(img.blob)
    expect(opts).toEqual({ contentType: 'image/webp', upsert: false })
    expect(insert).toHaveBeenCalledWith({
      bug_id: 'b',
      storage_path: path,
      width: 10,
      height: 20,
      size_bytes: 4,
    })
    expect(onProgress.mock.calls).toEqual([[0], [1]])
  })

  it('uses jpg extension for jpeg blobs', async () => {
    await uploadAttachment({ workspaceId: 'w', bugId: 'b', image: image('image/jpeg') })
    expect(upload.mock.calls[0][0]).toMatch(/\.jpg$/)
  })

  it('throws on storage error without inserting a row', async () => {
    const err = { message: 'too large' }
    upload.mockResolvedValue({ error: err })
    const onProgress = vi.fn()
    await expect(
      uploadAttachment({ workspaceId: 'w', bugId: 'b', image: image('image/webp'), onProgress }),
    ).rejects.toBe(err)
    expect(insert).not.toHaveBeenCalled()
    expect(onProgress).not.toHaveBeenCalledWith(1)
  })

  it('removes the uploaded object when the insert fails', async () => {
    const err = { message: 'rls' }
    single.mockResolvedValue({ data: null, error: err })
    await expect(
      uploadAttachment({ workspaceId: 'w', bugId: 'b', image: image('image/webp') }),
    ).rejects.toBe(err)
    expect(removeFn).toHaveBeenCalledWith([upload.mock.calls[0][0]])
  })

  it('still surfaces the insert error when cleanup throws', async () => {
    const err = { message: 'rls' }
    single.mockResolvedValue({ data: null, error: err })
    removeFn.mockRejectedValue(new Error('cleanup'))
    await expect(
      uploadAttachment({ workspaceId: 'w', bugId: 'b', image: image('image/webp') }),
    ).rejects.toBe(err)
  })

  it('stores vector annotations with the unmarked image when given', async () => {
    const annotations = {
      v: 1 as const,
      shapes: [{ type: 'pin' as const, color: 'danger' as const, n: 1, x: 0.5, y: 0.5 }],
    }
    await uploadAttachment({
      workspaceId: 'w',
      bugId: 'b',
      image: image('image/webp'),
      annotations,
    })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ annotations }))
  })

  it('removes the object and surfaces a missing annotations column', async () => {
    const err = { code: 'PGRST204', message: "Could not find the 'annotations' column" }
    single.mockResolvedValue({ data: null, error: err })
    await expect(
      uploadAttachment({
        workspaceId: 'w',
        bugId: 'b',
        image: image('image/webp'),
        annotations: { v: 1, shapes: [] },
      }),
    ).rejects.toBe(err)
    expect(removeFn).toHaveBeenCalledWith([upload.mock.calls[0][0]])
  })
})
