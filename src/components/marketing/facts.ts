import raw from 'virtual:squash-facts'
import type { SquashFacts } from './facts-types'

/** Numbers counted from the repository at build time (see vite-plugin-facts.ts). */
export const facts = raw as SquashFacts
