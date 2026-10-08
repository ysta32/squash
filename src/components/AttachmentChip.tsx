import { X } from 'lucide-react'

interface AttachmentChipProps {
  name: string
  previewUrl: string
  onRemove: () => void
  onEdit?: () => void
  /** 0..1; when defined a progress ring is drawn over the thumbnail. */
  progress?: number
}

const RADIUS = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AttachmentChip({
  name,
  previewUrl,
  onRemove,
  onEdit,
  progress,
}: AttachmentChipProps) {
  return (
    // 96×72: big enough to tell screenshots apart at a glance.
    <div className="group relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-md border border-line-2 bg-surface-3 shadow-elev-1">
      {onEdit ? (
        <button
          type="button"
          aria-label={`Mark up ${name}`}
          onClick={onEdit}
          title={`Mark up ${name}`}
          className="focus-ring-inset block size-full rounded-md"
        >
          <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
          <span
            aria-hidden="true"
            className="t pointer-events-none absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center font-mono text-[10px] leading-4 text-surface-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 pointer-coarse:opacity-100"
          >
            Mark up
          </span>
        </button>
      ) : (
        <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
      )}
      {progress !== undefined && progress < 1 && (
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="pointer-events-none absolute inset-0 size-full -rotate-90 bg-ink/30"
        >
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
        title={`Remove ${name}`}
        // Shown on hover or focus; always on touch screens, where it grows to a 32px target.
        className="t absolute top-1 right-1 flex size-6 items-center justify-center rounded-sm bg-ink/80 text-surface-2 opacity-0 outline-none group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus [@media(hover:none)]:opacity-100 pointer-coarse:size-[2.2857rem] pointer-coarse:opacity-100"
      >
        <X size={14} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
