// Stand-in for src/lib/supabase.ts used only by the screenshot harness. It serves the seed data
// from memory, reports every realtime channel as connected, and answers the local Claude helper's
// endpoints, so the real app renders a populated workspace with no backend.
import * as seed from './seed'

type Row = Record<string, unknown>

const db: Record<string, Row[]> = {
  profiles: [...seed.profiles],
  workspaces: [...seed.workspaces],
  workspace_members: [...seed.workspace_members],
  bugs: [...seed.bugs],
  bug_attachments: [...seed.bug_attachments],
  comments: [...seed.comments],
  bug_events: [...seed.bug_events],
  fix_runs: [...seed.fix_runs],
}

const byId = (table: string, id: unknown) => db[table].find((r) => r.id === id) ?? null

/** Expands the embedded relations the app asks for in its select strings. */
function embed(table: string, cols: string, row: Row): Row {
  const out = { ...row }
  if (cols.includes('bug_attachments(')) {
    out.bug_attachments = db.bug_attachments.filter((a) => a.bug_id === row.id)
  }
  if (cols.includes('workspaces(')) out.workspaces = byId('workspaces', row.workspace_id)
  if (cols.includes('profiles(')) {
    const key = cols.includes('profile:') ? 'profile' : 'profiles'
    out[key] = byId('profiles', table === 'workspace_members' ? row.user_id : row.author_id)
  }
  return out
}

let seq = 1000

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private cols = '*'
  private filters: [string, unknown][] = []
  private sort: { col: string; asc: boolean } | null = null
  private max = Infinity
  private shape: 'many' | 'maybe' | 'one' = 'many'
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Row | Row[] | null = null

  constructor(private table: string) {}

  select(cols = '*') {
    this.cols = cols
    return this
  }
  insert(payload: Row | Row[]) {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  update(payload: Row) {
    this.op = 'update'
    this.payload = payload
    return this
  }
  upsert(payload: Row | Row[]) {
    return this.insert(payload)
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push([col, value])
    return this
  }
  in() {
    return this
  }
  neq() {
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sort = { col, asc: opts?.ascending ?? true }
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.shape = 'maybe'
    return this
  }
  single() {
    this.shape = 'one'
    return this
  }

  private matches(row: Row) {
    return this.filters.every(([c, v]) => row[c] === v)
  }

  private run(): unknown {
    const rows = db[this.table] ?? (db[this.table] = [])
    let result: Row[]
    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      result = list.map((p) => {
        const row: Row = { id: `row-${++seq}`, created_at: new Date().toISOString(), ...p }
        if (this.table === 'bugs') {
          row.number = Math.max(...db.bugs.map((b) => b.number as number)) + 1
          row.status ??= 'open'
          row.resolved_by ??= null
          row.resolved_at ??= null
          row.resolution_note ??= null
          row.assignee_id ??= null
          row.updated_at = row.created_at
          // The database logs this with a trigger.
          db.bug_events.push({
            id: `row-${++seq}`,
            bug_id: row.id,
            actor_id: row.filed_by,
            type: 'filed',
            note: null,
            created_at: row.created_at,
          })
        }
        rows.unshift(row)
        return row
      })
    } else if (this.op === 'update') {
      result = rows.filter((r) => this.matches(r))
      for (const r of result) Object.assign(r, this.payload)
    } else if (this.op === 'delete') {
      result = rows.filter((r) => this.matches(r))
      db[this.table] = rows.filter((r) => !result.includes(r))
    } else {
      result = rows.filter((r) => this.matches(r))
    }
    if (this.sort) {
      const { col, asc } = this.sort
      result = [...result].sort(
        (a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1),
      )
    }
    result = result.slice(0, this.max).map((r) => embed(this.table, this.cols, r))
    if (this.shape === 'many') return result
    return result[0] ?? null
  }

  then<A = { data: unknown; error: null }, B = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const delay = this.table === 'bugs' && this.op === 'select' ? bugsDelayMs : 0
    const result =
      delay > 0
        ? new Promise<void>((done) => setTimeout(done, delay)).then(() => this.run())
        : Promise.resolve(this.run())
    return result.then((data) => ({ data, error: null })).then(onfulfilled, onrejected)
  }
}

type Listener = { type: string; event?: string; cb: (payload?: unknown) => void }

class Channel {
  private listeners: Listener[] = []
  constructor(readonly topic: string) {}
  on(type: string, filter: { event?: string }, cb: (payload?: unknown) => void) {
    this.listeners.push({ type, event: filter?.event, cb })
    return this
  }
  subscribe(cb?: (status: string) => void) {
    setTimeout(() => {
      cb?.('SUBSCRIBED')
      for (const l of this.listeners) if (l.type === 'presence' && l.event === 'sync') l.cb()
    }, 0)
    return this
  }
  presenceState() {
    return Object.fromEntries(seed.presence.map((p) => [p.user_id, [p]]))
  }
  track() {
    return Promise.resolve('ok')
  }
  send() {
    return Promise.resolve('ok')
  }
  unsubscribe() {
    return Promise.resolve('ok')
  }
}

const me = seed.profiles.find((p) => p.id === seed.ME)!
const session = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: me.id,
    email: 'maya@lumen.dev',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: me.display_name },
    aud: 'authenticated',
    created_at: me.created_at,
  },
}

/** Images uploaded during a session, by storage path; seed images are served from /__shots/. */
const uploads = new Map<string, string>()
const signed = (path: string) => uploads.get(path) ?? `/__shots/${path.split('/').pop()}`

/** Shots of signed-out pages (landing, sign-in) set this flag before the app loads. */
const signedOut = localStorage.getItem('squash:demo-signed-out') === '1'
const current = signedOut ? null : session

/** Shots of the loading state hold the bug list fetch this long (ms) so skeletons stay up. */
const bugsDelayMs = Number(localStorage.getItem('squash:demo-delay-bugs') ?? 0) || 0

const ok = <T>(data: T) => Promise.resolve({ data, error: null })

export const supabase = {
  from: (table: string) => new Query(table),
  rpc: (name: string, args?: { p_code?: string; p_name?: string }) => {
    if (name === 'workspace_stats') return ok(seed.workspaceStats)
    if (name === 'create_workspace') {
      // Like the SQL function: a new workspace owned by the caller, with a fresh invite code.
      const created_at = new Date().toISOString()
      const ws = {
        id: `ws-new-${db.workspaces.length}`,
        name: (args?.p_name ?? '').trim(),
        invite_code: 'Q7RT4WXZ',
        owner_id: seed.ME,
        created_at,
      }
      db.workspaces.push(ws)
      db.workspace_members.push({
        workspace_id: ws.id,
        user_id: seed.ME,
        role: 'owner',
        joined_at: created_at,
      })
      return ok(ws)
    }
    if (name === 'workspace_preview') {
      // Same normalisation as the SQL function: drop whitespace, compare upper-case.
      const code = (args?.p_code ?? '').replace(/\s/g, '').toUpperCase()
      const ws = seed.workspaces.find((w) => w.invite_code === code)
      return ok(
        ws
          ? [
              {
                id: ws.id,
                name: ws.name,
                member_count: seed.workspace_members.filter((m) => m.workspace_id === ws.id).length,
              },
            ]
          : [],
      )
    }
    return ok(null)
  },
  channel: (topic: string) => new Channel(topic),
  getChannels: () => [],
  removeChannel: () => Promise.resolve('ok'),
  auth: {
    getSession: () => ok({ session: current }),
    getUser: () => ok({ user: current?.user ?? null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOAuth: () => ok(null),
    signInWithOtp: () => ok(null),
    signOut: () => ok(null),
  },
  storage: {
    from: () => ({
      createSignedUrl: (path: string) => ok({ signedUrl: signed(path) }),
      createSignedUrls: (paths: string[]) =>
        ok(paths.map((p) => ({ path: p, signedUrl: signed(p), error: null }))),
      upload: (path: string, blob: Blob) => {
        uploads.set(path, URL.createObjectURL(blob))
        return ok({ path })
      },
      list: () => ok([]),
      remove: () => ok([]),
    }),
  },
} as never

// The local Claude Code helper (127.0.0.1:4317), answered in-page so a real helper is never hit.
const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.startsWith('http://127.0.0.1:4317')) return realFetch(input, init)
  const path = new URL(url).pathname
  const json = (body: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
    )
  if (path === '/health') return json({ version: 4, platform: 'darwin' })
  if (path.endsWith('/folder')) return json({ folder: '~/code/lumen' })
  if (path.endsWith('/runs')) return json({ runs: seed.claudeRuns })
  if (path.endsWith('/results')) return json({ runs: [] })
  return json({ ok: true })
}
