import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge, Button, Field, Input, Label, Logo, Section, SpecimenLabel } from '.'

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('shows the pending label, keeps both labels in the layout, and ignores clicks', () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit" pendingLabel="Filing…" onClick={onClick}>
          File
        </Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'File' })
    expect(button).not.toHaveAttribute('aria-busy')
    // The idle button still contains the pending label so its width never changes.
    expect(button).toHaveTextContent('Filing…')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)

    rerender(
      <form onSubmit={onSubmit}>
        <Button type="submit" pending pendingLabel="Filing…" onClick={onClick}>
          File
        </Button>
      </form>,
    )
    const busy = screen.getByRole('button', { name: 'Filing…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).not.toBeDisabled()
    fireEvent.click(busy)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('Field', () => {
  it('labels the control and links its hint and error', () => {
    render(
      <Field label="Workspace name" hint="Shown to everyone." error="Name is required.">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>,
    )
    const input = screen.getByLabelText('Workspace name')
    expect(input).toHaveAccessibleDescription('Shown to everyone. Name is required.')
    expect(input).toBeInvalid()
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
  })
})

describe('SpecimenLabel', () => {
  it('joins present fields with hidden dots that read as commas', () => {
    const { container } = render(
      <SpecimenLabel
        segments={['No. 024', 'Bug', false, null, 'Critical']}
        detail={['/checkout']}
      />,
    )
    const label = container.querySelector('p')
    expect(label).toHaveTextContent('No. 024·, Bug·, Critical/checkout')
    const dots = container.querySelectorAll('[aria-hidden="true"]')
    expect(dots).toHaveLength(2)
    dots.forEach((dot) => expect(dot).toHaveTextContent('·'))
  })
})

describe('Label, Badge, Section, Logo', () => {
  it('renders an eyebrow as the requested element', () => {
    render(<Label as="h3">Screenshots 2</Label>)
    expect(screen.getByRole('heading', { level: 3, name: 'Screenshots 2' })).toBeInTheDocument()
  })

  it('keeps badge text as written (case is presentation only)', () => {
    render(<Badge tone="accent">owner</Badge>)
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('titles a section with its heading and eyebrow', () => {
    render(
      <Section eyebrow="Danger zone" title="Delete workspace" tone="danger" footer={<button />}>
        body
      </Section>,
    )
    const section = screen.getByRole('heading', { level: 2, name: 'Delete workspace' })
    expect(section.closest('section')).toHaveTextContent('Danger zone')
  })

  it('draws the pin mark beside the lowercase wordmark', () => {
    const { container } = render(<Logo />)
    expect(container).toHaveTextContent('squash')
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelector('circle')).toHaveAttribute('fill', 'var(--accent)')
  })
})
