export interface CompressedImage {
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024
export const MAX_EDGE = 1920
export const TARGET_BYTES = 300 * 1024

async function decodeImage(file: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Some browsers decode more formats through an image element.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('image_decode_failed'))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export async function compressImage(file: File | Blob): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('not_image')
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error('too_large')

  const decoded = await decodeImage(file)
  const canvas = document.createElement('canvas')
  try {
    if (decoded.width <= 0 || decoded.height <= 0) throw new Error('image_decode_failed')
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height))
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
  } finally {
    decoded.release()
  }

  const encode = (type: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality))

  let type = 'image/webp'
  let blob: Blob | null = null
  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    blob = await encode(type, quality)
    if (type === 'image/webp' && blob?.type !== type) {
      type = 'image/jpeg'
      blob = await encode(type, quality)
    }
    if (!blob || blob.type !== type) throw new Error('image_encode_failed')
    if (blob.size <= TARGET_BYTES) break
  }
  if (!blob) throw new Error('image_encode_failed')
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    previewUrl: URL.createObjectURL(blob),
  }
}

export function useImageCompression(): { compress: typeof compressImage } {
  return { compress: compressImage }
}
