import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AnnotationChecklist } from './AnnotationChecklist'

afterEach(cleanup)

const annotations = {
  v: 1,
  shapes: [
    { type: 'pin', color: 'danger', n: 2, x: 0.1, y: 0.1 },
    { type: 'box', color: 'danger', x: 0, y: 0, w: 0.5, h: 0.5 },
    { type: 'pin', color: 'warning', n: 1, x: 0.2, y: 0.2, note: 'Banner overlaps Pay now' },
  ],
}

describe('AnnotationChecklist', () => {
  it('lists one line per pin in pin order, with its note', () => {
    render(<AnnotationChecklist annotations={annotations} />)
    const items = within(screen.getByRole('list', { name: 'Pinned issues' })).getAllByRole(
      'listitem',
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Pin 1: Banner overlaps Pay now')
    expect(items[1]).toHaveTextContent('Pin 2: No note')
    expect(items[0].querySelector('[aria-hidden]')).toHaveClass('text-warning')
    expect(items[1].querySelector('[aria-hidden]')).toHaveClass('text-danger')
  })

  it('strikes through pins marked done', () => {
    render(<AnnotationChecklist annotations={annotations} done={new Set([1])} />)
    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('Pin 1, done:')
    expect(first.querySelector('.line-through')).not.toBeNull()
    expect(second.querySelector('.line-through')).toBeNull()
  })

  it.each([
    ['no annotations', null],
    ['malformed annotations', { v: 1, shapes: 'nope' }],
    ['no pins', { v: 1, shapes: [{ type: 'box', x: 0, y: 0, w: 1, h: 1 }] }],
  ])('renders nothing for %s', (_, value) => {
    const { container } = render(<AnnotationChecklist annotations={value} />)
    expect(container).toBeEmptyDOMElement()
  })
})
