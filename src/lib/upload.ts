import type { CompressedImage } from '../hooks/useImageCompression'
import type { Annotations } from './annotations'
import { supabase } from './supabase'
import type { Json } from './database.types'
import type { BugAttachment } from './types'
import { randomId } from './utils'

export async function uploadAttachment(args: {
  workspaceId: string
  bugId: string
  image: CompressedImage
  /** Vector markup stored with the unmarked image. Omitted from the insert when absent. */
  annotations?: Annotations
  onProgress?: (p: number) => void
}): Promise<BugAttachment> {
  const { workspaceId, bugId, image, annotations, onProgress } = args
  const extension = image.blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const path = `${workspaceId}/${bugId}/${randomId()}.${extension}`
  // Supabase has no upload progress events: 0 is indeterminate, 1 is done.
  onProgress?.(0)
  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, image.blob, {
      contentType: image.blob.type,
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('bug_attachments')
    .insert({
      bug_id: bugId,
      storage_path: path,
      width: image.width,
      height: image.height,
      size_bytes: image.blob.size,
      ...(annotations ? { annotations: annotations as unknown as Json } : {}),
    })
    .select()
    .single()
  if (error) {
    try {
      await supabase.storage.from('screenshots').remove([path])
    } catch {
      throw error
    }
    throw error
  }
  onProgress?.(1)
  return data
}
