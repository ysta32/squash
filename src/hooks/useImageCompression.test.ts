import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage, MAX_ORIGINAL_BYTES, TARGET_BYTES } from './useImageCompression'
import { usePasteImage } from './usePasteImage'
import { useSpeech } from './useSpeech'
import { uploadAttachment } from '../lib/upload'

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
  bucket: vi.fn(),
  table: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: { from: storage.bucket },
    from: storage.table,
  },
}))

beforeEach(() => {
  storage.bucket.mockReturnValue({ upload: storage.upload })
  storage.table.mockReturnValue({ insert: storage.insert })
  storage.insert.mockReturnValue({ select: () => ({ single: storage.single }) })
  storage.upload.mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('compressImage', () => {
  it('rejects non-images and oversized originals before decoding', async () => {
    await expect(compressImage(new Blob(['text'], { type: 'text/plain' }))).rejects.toThrow(
      'not_image',
    )
    await expect(
      compressImage(new Blob([new Uint8Array(MAX_ORIGINAL_BYTES + 1)], { type: 'image/png' })),
    ).rejects.toThrow('too_large')
  })

  function mockCanvas(width = 3840, height = 2160) {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }))
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    const createObjectURL = vi.fn().mockReturnValue('blob:preview')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    return { close, drawImage, createObjectURL }
  }

  it('scales the long edge and reduces quality until the target is met', async () => {
    const { close, drawImage } = mockCanvas()
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback, type, quality) => {
        callback(new Blob([new Uint8Array(quality === 0.82 ? TARGET_BYTES + 1 : 100)], { type }))
      })
    const result = await compressImage(new Blob(['image'], { type: 'image/png' }))
    expect(result).toMatchObject({ width: 1920, height: 1080, previewUrl: 'blob:preview' })
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 1080)
    expect(toBlob.mock.calls.map((call) => call.slice(1))).toEqual([
      ['image/webp', 0.82],
      ['image/webp', 0.7],
    ])
    expect(result.blob.type).toBe('image/webp')
    expect(close).toHaveBeenCalledOnce()
  })

  it('falls back to JPEG when WebP returns PNG and does not upscale', async () => {
    mockCanvas(400, 800)
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback, type) =>
        callback(
          new Blob(['encoded'], {
            type: type === 'image/webp' ? 'image/png' : type,
          }),
        ),
      )
    const result = await compressImage(new Blob(['image'], { type: 'image/png' }))
    expect(result.blob.type).toBe('image/jpeg')
    expect(result).toMatchObject({ width: 400, height: 800 })
    expect(toBlob.mock.calls.map((call) => call.slice(1))).toEqual([
      ['image/webp', 0.82],
      ['image/jpeg', 0.82],
    ])
  })

  it('returns the last encoding when all quality levels exceed the target', async () => {
    mockCanvas()
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback, type) =>
        callback(new Blob([new Uint8Array(TARGET_BYTES + 1)], { type })),
      )
    const result = await compressImage(new Blob(['image'], { type: 'image/png' }))
    expect(toBlob.mock.calls.map((call) => call[2])).toEqual([0.82, 0.7, 0.6, 0.5, 0.4])
    expect(result.blob.size).toBe(TARGET_BYTES + 1)
  })

  it('releases decoded resources if drawing fails', async () => {
    const { close } = mockCanvas()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(compressImage(new Blob(['image'], { type: 'image/png' }))).rejects.toThrow(
      'canvas_unavailable',
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it('decodes through an image element when bitmap decoding is unavailable', async () => {
    mockCanvas()
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 80
        naturalHeight = 40
        onload: (() => void) | null = null
        set src(_value: string) {
          this.onload?.()
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) =>
      callback(new Blob(['encoded'], { type })),
    )
    await expect(compressImage(new Blob(['image'], { type: 'image/png' }))).resolves.toMatchObject({
      width: 80,
      height: 40,
    })
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })
})

describe('usePasteImage', () => {
  const image = new File(['image'], 'shot.png', { type: 'image/png' })
  function paste(target: EventTarget = document): Event {
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        items: [
          { type: 'text/plain', getAsFile: () => null },
          { type: image.type, getAsFile: () => image },
        ],
      },
    })
    target.dispatchEvent(event)
    return event
  }

  it('collects pasted images from inputs without cancelling text paste', () => {
    const onFiles = vi.fn()
    renderHook(() => usePasteImage(onFiles))
    const input = document.createElement('textarea')
    document.body.append(input)
    const event = paste(input)
    input.remove()
    expect(onFiles).toHaveBeenCalledWith([image])
    expect(event.defaultPrevented).toBe(false)
  })

  it('honors enabled and removes listeners on unmount', () => {
    const onFiles = vi.fn()
    const { rerender, unmount } = renderHook(({ enabled }) => usePasteImage(onFiles, { enabled }), {
      initialProps: { enabled: false },
    })
    paste()
    expect(onFiles).not.toHaveBeenCalled()
    rerender({ enabled: true })
    paste()
    expect(onFiles).toHaveBeenCalledOnce()
    unmount()
    paste()
    expect(onFiles).toHaveBeenCalledOnce()
  })

  it('prevents dragover and collects only image files on drop', () => {
    const onFiles = vi.fn()
    renderHook(() => usePasteImage(onFiles))
    const dragover = new Event('dragover', { cancelable: true })
    document.dispatchEvent(dragover)
    expect(dragover.defaultPrevented).toBe(true)
    const drop = new Event('drop', { cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [image, new File(['text'], 'a.txt')] },
    })
    document.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    expect(onFiles).toHaveBeenCalledWith([image])
  })
})

describe('uploadAttachment', () => {
  it.each([
    ['image/webp', 'webp'],
    ['image/jpeg', 'jpg'],
  ])(
    'uploads %s to the workspace/bug path and returns the inserted row',
    async (type, extension) => {
      const row = { id: 'attachment' }
      storage.single.mockResolvedValue({ data: row, error: null })
      const onProgress = vi.fn()
      const blob = new Blob(['image'], { type })
      const result = await uploadAttachment({
        workspaceId: 'workspace',
        bugId: 'bug',
        image: { blob, width: 100, height: 50, previewUrl: 'blob:preview' },
        onProgress,
      })
      const path: unknown = storage.upload.mock.calls[0][0]
      expect(path).toMatch(new RegExp(`^workspace/bug/[0-9a-f-]{36}\\.${extension}$`))
      expect(storage.bucket).toHaveBeenCalledWith('screenshots')
      expect(storage.upload).toHaveBeenCalledWith(path, blob, { contentType: type, upsert: false })
      expect(storage.table).toHaveBeenCalledWith('bug_attachments')
      expect(storage.insert).toHaveBeenCalledWith({
        bug_id: 'bug',
        storage_path: path,
        width: 100,
        height: 50,
        size_bytes: blob.size,
      })
      expect(result).toBe(row)
      expect(onProgress.mock.calls).toEqual([[0], [1]])
    },
  )

  it.each(['upload', 'insert'])(
    'propagates %s failures without reporting completion',
    async (stage) => {
      const error = new Error('failed')
      if (stage === 'upload') storage.upload.mockResolvedValue({ error })
      else storage.single.mockResolvedValue({ data: null, error })
      const onProgress = vi.fn()
      await expect(
        uploadAttachment({
          workspaceId: 'workspace',
          bugId: 'bug',
          image: {
            blob: new Blob(['image'], { type: 'image/webp' }),
            width: 1,
            height: 1,
            previewUrl: '',
          },
          onProgress,
        }),
      ).rejects.toBe(error)
      expect(onProgress.mock.calls).toEqual([[0]])
      if (stage === 'upload') expect(storage.insert).not.toHaveBeenCalled()
    },
  )
})

describe('useSpeech', () => {
  function mockRecognition() {
    const instance: InstanceType<NonNullable<Window['SpeechRecognition']>> = {
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    }
    vi.stubGlobal(
      'SpeechRecognition',
      class {
        constructor() {
          return instance
        }
      },
    )
    return instance
  }

  it('splits results, restarts after automatic end, and stops explicitly', () => {
    const instance = mockRecognition()
    const onFinal = vi.fn()
    const onInterim = vi.fn()
    const { result, unmount } = renderHook(() => useSpeech({ onFinal, onInterim }))
    expect(result.current.supported).toBe(true)
    expect(instance).toMatchObject({
      continuous: true,
      interimResults: true,
      lang: navigator.language,
    })
    act(() => result.current.start())
    expect(result.current.listening).toBe(true)
    act(() =>
      instance.onresult?.({
        resultIndex: 1,
        results: [
          { isFinal: true, 0: { transcript: 'old' } },
          { isFinal: true, 0: { transcript: 'new' } },
          { isFinal: false, 0: { transcript: 'pending' } },
        ],
      }),
    )
    expect(onFinal).toHaveBeenCalledWith('new')
    expect(onInterim).toHaveBeenCalledWith('pending')
    act(() => instance.onend?.())
    expect(instance.start).toHaveBeenCalledTimes(2)
    act(() => result.current.stop())
    act(() => instance.onend?.())
    expect(instance.start).toHaveBeenCalledTimes(2)
    expect(instance.stop).toHaveBeenCalledOnce()
    expect(result.current.listening).toBe(false)
    unmount()
    expect(instance.abort).toHaveBeenCalledOnce()
    expect(instance.onend).toBeNull()
  })

  it('reports denied permission and does not restart', () => {
    const instance = mockRecognition()
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onInterim: vi.fn() }))
    act(() => result.current.toggle())
    act(() => instance.onerror?.({ error: 'not-allowed' }))
    act(() => instance.onend?.())
    expect(result.current.error).toBe('Microphone permission denied')
    expect(result.current.listening).toBe(false)
    expect(instance.start).toHaveBeenCalledOnce()
  })
})
