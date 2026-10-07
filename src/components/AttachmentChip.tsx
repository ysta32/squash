import { Pencil, X } from 'lucide-react'

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
    <div className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-line-2 bg-surface-3 shadow-elev-1">
      {onEdit ? (
        <button
          type="button"
          aria-label={`Mark up ${name}`}
          onClick={onEdit}
          title={`Mark up ${name}`}
          className="group/edit block h-full w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
          <span
            aria-hidden="true"
            className="t pointer-events-none absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-sm bg-surface-2 text-ink shadow-elev-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Pencil size={11} />
          </span>
        </button>
      ) : (
        <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
      )}
      {progress !== undefined && progress < 1 && (
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 bg-scrim"
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
        className="t absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-ink shadow-elev-2 opacity-0 outline-none hover:text-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  )
}
