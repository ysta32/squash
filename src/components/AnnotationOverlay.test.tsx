import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AnnotationOverlay } from './AnnotationOverlay'

afterEach(cleanup)

const annotations = {
  v: 1,
  shapes: [
    { type: 'box', color: 'warning', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    { type: 'arrow', color: 'danger', x1: 0, y1: 0, x2: 0.5, y2: 0.5 },
    {
      type: 'pen',
      color: 'success',
      points: [
        [0, 1],
        [0.5, 0.5],
      ],
    },
    { type: 'pin', color: 'danger', n: 3, x: 0.25, y: 0.75, note: 'Here' },
  ],
}

describe('AnnotationOverlay', () => {
  it('draws every layer in image coordinates over the screenshot', () => {
    render(<AnnotationOverlay annotations={annotations} width={1000} height={500} />)
    const svg = screen.getByTestId('annotation-overlay')
    expect(svg).toHaveAttribute('viewBox', '0 0 1000 500')
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('pointer-events-none', 'absolute', 'inset-0')
    const rect = svg.querySelector('rect')
    expect(rect).toHaveAttribute('x', '100')
    expect(rect).toHaveAttribute('y', '100')
    expect(rect).toHaveAttribute('width', '300')
    expect(rect).toHaveAttribute('height', '200')
    expect(rect).toHaveAttribute('stroke', 'var(--warning)')
    expect(svg.querySelector('line')).toHaveAttribute('x2', '500')
    const polylines = svg.querySelectorAll('polyline')
    expect(polylines).toHaveLength(2)
    expect(polylines[1]).toHaveAttribute('points', '0,500 500,250')
    expect(polylines[1]).toHaveAttribute('stroke', 'var(--success)')
  })

  it('renders pins as circled numerals in the accent and Plex Mono 500', () => {
    render(<AnnotationOverlay annotations={annotations} width={1000} height={500} />)
    const pin = screen.getByTestId('annotation-overlay').querySelector('[data-pin="3"]')
    expect(pin?.querySelector('circle')).toHaveAttribute('cx', '250')
    expect(pin?.querySelector('circle')).toHaveAttribute('cy', '375')
    expect(pin?.querySelector('circle')).toHaveAttribute('stroke', 'var(--accent)')
    const text = pin?.querySelector('text')
    expect(text).toHaveTextContent('3')
    expect(text).toHaveAttribute('font-family', 'var(--font-mono)')
    expect(text).toHaveAttribute('font-weight', '500')
    expect(text).toHaveAttribute('fill', 'var(--accent)')
  })

  it('matches object-fit cover for cropped thumbnails', () => {
    render(<AnnotationOverlay annotations={annotations} width={10} height={10} fit="cover" />)
    expect(screen.getByTestId('annotation-overlay')).toHaveAttribute(
      'preserveAspectRatio',
      'xMidYMid slice',
    )
  })

  it.each([
    ['no annotations', null, 100],
    ['malformed annotations', { v: 2, shapes: [] }, 100],
    ['no shapes', { v: 1, shapes: [] }, 100],
    ['an unknown size', annotations, 0],
  ])('renders nothing for %s', (_, value, size) => {
    const { container } = render(
      <AnnotationOverlay annotations={value} width={size} height={size} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
