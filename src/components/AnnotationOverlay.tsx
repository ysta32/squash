import { arrowHead } from '../lib/annotate'
import { parseAnnotations } from '../lib/annotations'
import { cn } from '../lib/utils'

interface AnnotationOverlayProps {
  /** A screenshot's stored `annotations` (raw jsonb); malformed values render nothing. */
  annotations: unknown
  /** The image's natural size, so the overlay keeps its aspect ratio. */
  width: number
  height: number
  /** Match the image's object-fit so marks line up with the pixels they point at. */
  fit?: 'contain' | 'cover'
  className?: string
}

/**
 * Live markup layers drawn over an unmarked screenshot: boxes, arrows and drawings in their
 * token colors, pins as circled numerals in Plex Mono 500 and the accent (DESIGN.md
 * Iconography). Position it over the image (absolute inset-0 by default); it ignores pointers.
 */
export function AnnotationOverlay({
  annotations,
  width,
  height,
  fit = 'contain',
  className,
}: AnnotationOverlayProps) {
  const doc = parseAnnotations(annotations)
  if (!doc || doc.shapes.length === 0 || !(width > 0) || !(height > 0)) return null
  const unit = Math.max(width, height)
  const radius = unit * 0.018
  const stroke = { strokeWidth: 2, vectorEffect: 'non-scaling-stroke' as const }
  return (
    <svg
      data-testid="annotation-overlay"
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {doc.shapes.map((shape, index) => {
        const color = `var(--${shape.color})`
        switch (shape.type) {
          case 'box':
            return (
              <rect
                key={index}
                x={shape.x * width}
                y={shape.y * height}
                width={shape.w * width}
                height={shape.h * height}
                stroke={color}
                {...stroke}
              />
            )
          case 'arrow': {
            const from = { x: shape.x1 * width, y: shape.y1 * height }
            const to = { x: shape.x2 * width, y: shape.y2 * height }
            const [left, right] = arrowHead(from, to, unit * 0.02)
            return (
              <g key={index} stroke={color} {...stroke}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...stroke} />
                <polyline
                  points={`${left.x},${left.y} ${to.x},${to.y} ${right.x},${right.y}`}
                  {...stroke}
                />
              </g>
            )
          }
          case 'pen':
            return (
              <polyline
                key={index}
                points={shape.points.map(([x, y]) => `${x * width},${y * height}`).join(' ')}
                stroke={color}
                {...stroke}
              />
            )
          case 'pin':
            return (
              <g key={index} data-pin={shape.n}>
                <circle
                  cx={shape.x * width}
                  cy={shape.y * height}
                  r={radius}
                  fill="var(--bg)"
                  stroke="var(--accent)"
                  {...stroke}
                />
                <text
                  x={shape.x * width}
                  y={shape.y * height}
                  fill="var(--accent)"
                  fontFamily="var(--font-mono)"
                  fontWeight={500}
                  fontSize={radius * 1.15}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {shape.n}
                </text>
              </g>
            )
        }
      })}
    </svg>
  )
}
