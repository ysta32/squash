import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { missingConfig } from '../lib/config'
import { ConfigError } from './ConfigError'

describe('missingConfig', () => {
  it('lists absent and blank Supabase variables', () => {
    expect(missingConfig({})).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    expect(
      missingConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: '  ' }),
    ).toEqual(['VITE_SUPABASE_ANON_KEY'])
  })

  it('returns nothing when both are set', () => {
    expect(
      missingConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual([])
  })
})

describe('ConfigError', () => {
  it('names each missing variable and links the self-host guide', () => {
    render(<ConfigError missing={['VITE_SUPABASE_URL']} />)
    expect(screen.getByText("Squash isn't configured yet")).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'the self-host guide' })).toHaveAttribute(
      'href',
      'https://github.com/ysta32/squash#self-host',
    )
  })
})
