import { describe, expect, it } from 'vitest'
import { INVITE_CODE, parseInviteInput } from './inviteCode'

describe('parseInviteInput', () => {
  it('upper-cases a typed code and drops spaces and dashes', () => {
    expect(parseInviteInput('k3x9 lmnp')).toBe('K3X9LMNP')
    expect(parseInviteInput('K3X9-LMNP')).toBe('K3X9LMNP')
  })

  it('takes the code out of a pasted invite link', () => {
    expect(parseInviteInput('https://squash.example/join/K3X9LMNP')).toBe('K3X9LMNP')
    expect(parseInviteInput('  http://localhost:4224/join/k3x9lmnp?x=1#top ')).toBe('K3X9LMNP')
  })
})

describe('INVITE_CODE', () => {
  it('matches the database format: 8 of A-Z and 2-9 without I, O, 0 or 1', () => {
    expect(INVITE_CODE.test('K3X9LMNP')).toBe(true)
    expect(INVITE_CODE.test('ABCD2345')).toBe(true)
    for (const bad of ['ABCD1234', 'ABCDO234', 'ABCDI234', 'ABC2345', 'ABCD23456', 'k3x9lmnp']) {
      expect(INVITE_CODE.test(bad), bad).toBe(false)
    }
  })
})
