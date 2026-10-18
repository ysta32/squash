import { requireUserId } from '../hooks/useBug'
import {
  BridgeError,
  PROJECT_VERSION,
  createBridgeProject,
  pingBridge,
  projectSlug,
  sendToBridge,
} from './claudeExport'
import { supabase } from './supabase'
import type { BugWithMeta, Workspace } from './types'

/** bugs.title cap (CHECK constraint). */
const TITLE_MAX = 200
/** bugs.description cap (CHECK constraint). */
export const BRIEF_MAX = 20000

export interface NewProjectInput {
  /** Display name, e.g. "Recipe Box". The folder and repo use its slug. */
  name: string
  /** What the person wants built: becomes the description of the project's first feature. */
  brief: string
  /** Folder to create the project in; the helper shows a folder picker when omitted. */
  parent?: string
  /** Whether the GitHub repo is public (private by default). */
  isPublic: boolean
  origin: string
}

export interface NewProjectResult {
  workspace: Workspace
  folder: string
  /** The first feature, which Claude Code is now building. */
  bugNumber: number
}

/**
 * Starts a project from nothing: a Squash workspace for it, an empty folder (a git repo on main)
 * made by the local helper, a first feature describing what to build, and a Claude Code run that
 * builds it, creates the GitHub repo and pushes. When the folder cannot be made, the new
 * workspace is deleted again so nothing half-made is left behind.
 */
export async function startNewProject({
  name,
  brief,
  parent,
  isPublic,
  origin,
}: NewProjectInput): Promise<NewProjectResult> {
  const title = name.trim()
  const slug = projectSlug(title)
  if (!slug) throw new Error('Give the project a name with some letters or numbers.')
  if (!brief.trim()) throw new Error('Say what you want built.')
  const status = await pingBridge()
  if (!status || status.version < PROJECT_VERSION) {
    throw new BridgeError(
      status
        ? 'Update the Claude Code helper to create projects (Claude setup).'
        : 'Start the Claude Code helper first (Claude setup).',
      status ? 'outdated' : 'unreachable',
    )
  }

  const { data: workspace, error } = await supabase.rpc('create_workspace', { p_name: title })
  if (error || !workspace) throw new Error(error?.message ?? 'Could not create the workspace.')

  let folder: string
  try {
    folder = await createBridgeProject({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      name: slug,
      ...(parent?.trim() ? { parent: parent.trim() } : {}),
    })
  } catch (err) {
    await supabase.rpc('delete_workspace', { p_workspace_id: workspace.id })
    throw err
  }

  const filedBy = await requireUserId()
  const { data: row, error: bugError } = await supabase
    .from('bugs')
    .insert({
      workspace_id: workspace.id,
      title: `Build ${title}`.slice(0, TITLE_MAX),
      description: brief.trim().slice(0, BRIEF_MAX),
      kind: 'feature',
      filed_by: filedBy,
    })
    .select()
    .single()
  if (bugError || !row) throw new Error(bugError?.message ?? 'Could not save what to build.')
  const bug: BugWithMeta = { ...row, attachments: [] }

  await sendToBridge({
    bugs: [bug],
    members: [],
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    origin,
    mode: 'create',
    project: { name: slug, public: isPublic },
  })
  return { workspace, folder, bugNumber: bug.number }
}
