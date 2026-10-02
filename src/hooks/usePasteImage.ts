import { useEffect } from 'react'

export function usePasteImage(
  onFiles: (files: File[]) => void,
  opts?: { enabled?: boolean },
): void {
  const enabled = opts?.enabled ?? true
  useEffect(() => {
    if (!enabled) return

    const onPaste = (event: ClipboardEvent): void => {
      const files: File[] = []
      for (const item of Array.from(event.clipboardData?.items ?? [])) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (file) files.push(file)
      }
      if (files.length > 0) onFiles(files)
    }
    const onDragOver = (event: DragEvent): void => event.preventDefault()
    const onDrop = (event: DragEvent): void => {
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      )
      if (files.length === 0) return
      event.preventDefault()
      onFiles(files)
    }

    document.addEventListener('paste', onPaste)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [enabled, onFiles])
}
