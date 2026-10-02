import { X } from 'lucide-react'

interface AttachmentChipProps {
  name: string
  previewUrl: string
  onRemove: () => void
  /** 0..1; when defined a progress ring is drawn over the thumbnail. */
  progress?: number
}

const RADIUS = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AttachmentChip({ name, previewUrl, onRemove, progress }: AttachmentChipProps) {
  return (
    <div className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--border)]">
      <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
      {progress !== undefined && progress < 1 && (
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90 bg-black/30">
          <circle
            cx="16"
            cy="16"
            r={RADIUS}
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 outline-none focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={10} />
      </button>
    </div>
  )
}
