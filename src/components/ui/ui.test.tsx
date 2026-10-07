import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, Field, Input } from '.'

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })
})

describe('Field', () => {
  it('labels the control and links its hint and error', () => {
    render(
      <Field label="Workspace name" hint="Shown to everyone." error="Name is required.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
      </Field>,
    )
    const input = screen.getByLabelText('Workspace name')
    expect(input).toHaveAccessibleDescription('Shown to everyone. Name is required.')
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
  })
})
