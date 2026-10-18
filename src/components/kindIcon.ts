import { Bug, FlaskConical, Lightbulb, ListTodo } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BugKind } from '../lib/types'

export const KIND_ICON: Record<BugKind, LucideIcon> = {
  bug: Bug,
  feature: Lightbulb,
  test: FlaskConical,
  todo: ListTodo,
}
