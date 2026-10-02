import type { CompressedImage } from '../hooks/useImageCompression'
import { supabase } from './supabase'
import type { BugAttachment } from './types'
import { randomId } from './utils'

export async function uploadAttachment(args: {
  workspaceId: string
  bugId: string
  image: CompressedImage
  onProgress?: (p: number) => void
}): Promise<BugAttachment> {
  const { workspaceId, bugId, image, onProgress } = args
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
    })
    .select()
    .single()
  if (error) throw error
  onProgress?.(1)
  return data
}
