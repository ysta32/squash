-- =============================================================================
-- Squash — proof of fix
--
-- Additive only; nothing here rewrites or removes existing data.
--   * public.fix_runs records one Claude Code run on one bug: the local helper's
--     batch id (run_id), its outcome, and the git evidence it reported (branch,
--     commit sha, PR URL, files changed / insertions / deletions), plus the
--     summary Claude wrote. One row per (bug, run). Rows go away with their bug.
--   * Members of the bug's workspace can read every run on it. A member records
--     a run only for a bug in their workspace and only as themselves
--     (created_by = auth.uid()). Only the creator (still a member) can update a
--     run, and only while it is 'running': finishing it (running -> succeeded /
--     failed / cancelled) is the last allowed change. No client deletes.
--   * workspace_id always equals the bug's workspace: the fix_runs_guard trigger
--     derives it from bug_id on insert (whatever the client sent; null when the
--     bug is not visible to anyone, which the RLS WITH CHECK then rejects with
--     the same 42501 an outsider gets, so there is no existence oracle), and the
--     insert policy re-checks it. It is immutable afterwards.
--   * The server owns started_at (clamped to the last 24 hours, never in the
--     future) and finished_at (set when the run leaves 'running').
--   * after_attachment_id (the "after" screenshot, a later UI task) must be an
--     attachment of the same bug; it is cleared if that attachment is deleted.
--   * At most 50 runs per bug.
--
-- Error codes added (see the list in 0001_init.sql):
--   fix_run_limit    the bug already has 50 fix runs (only raised for a member
--                    recording a run as themselves, so outsiders learn nothing)
--   immutable_field  now also raised by fix_runs updates that change id, bug_id,
--                    workspace_id, run_id, created_by or started_at, or that
--                    change the status of a finished run (clients cannot reach
--                    it: their column grant excludes those columns and the
--                    update policy only matches running rows)
--
-- Lock order: the per-bug limit takes the leaf advisory lock
-- 'squash:fix_runs:<bug_id>' inside a single-row INSERT trigger and nothing
-- else, like 'squash:attachments:<bug_id>' in 0001_init.sql.
--
-- Realtime: fix_runs joins the supabase_realtime publication like the other
-- bug tables. Its replica identity stays DEFAULT: INSERT / UPDATE payloads carry
-- the full new row (bug_id included), and there are no client deletes.
--
-- Re-runnable like 0001_init.sql.
-- =============================================================================

create table if not exists public.fix_runs (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The helper's batch name (SAFE_NAME in public/bridge/claude-bridge.mjs).
  run_id text not null check (run_id ~ '^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$'),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  branch text check (branch is null or branch ~ '^[^[:space:][:cntrl:]]{1,255}$'),
  commit_sha text check (commit_sha is null or commit_sha ~ '^[0-9a-f]{7,40}$'),
  pr_url text check (
    pr_url is null
    or (char_length(pr_url) <= 500 and pr_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[!-~]*$')
  ),
  files_changed int check (files_changed is null or files_changed >= 0),
  additions int check (additions is null or additions >= 0),
  deletions int check (deletions is null or deletions >= 0),
  summary text check (summary is null or char_length(summary) <= 4000),
  after_attachment_id uuid references public.bug_attachments (id) on delete set null,
  created_by uuid not null default auth.uid(), -- no FK: see attribution note in 0001_init.sql
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (bug_id, run_id),
  check ((status = 'running') = (finished_at is null))
);
create index if not exists fix_runs_bug_started_idx on public.fix_runs (bug_id, started_at desc);
create index if not exists fix_runs_workspace_started_idx
  on public.fix_runs (workspace_id, started_at desc);
create index if not exists fix_runs_after_attachment_idx
  on public.fix_runs (after_attachment_id) where after_attachment_id is not null;

-- -----------------------------------------------------------------------------
-- Guard: derive workspace_id, own the timestamps, cap runs per bug, keep
-- identity columns immutable and finished runs final.
-- -----------------------------------------------------------------------------
-- BEFORE INSERT / UPDATE, so it runs before the RLS WITH CHECK. SECURITY DEFINER
-- so the bug lookup does not depend on the caller's RLS (the policy still
-- checks membership against the derived workspace). For UPDATE, the policy
-- USING clause filters rows before this trigger fires, so a non-creator's or
-- finished-run update matches 0 rows and never reaches the raises below.
create or replace function public.fix_runs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.workspace_id := (select b.workspace_id from public.bugs b where b.id = new.bug_id);
    new.started_at := least(now(), greatest(coalesce(new.started_at, now()), now() - interval '1 day'));
    new.finished_at := case when new.status = 'running' then null else now() end;
    -- Only a signed-in member recording as themselves is limited (and may take
    -- the lock); anything else is left for the RLS WITH CHECK to reject.
    if auth.uid() is not null and new.created_by is not distinct from auth.uid()
       and new.workspace_id is not null and public.is_member(new.workspace_id) then
      perform pg_advisory_xact_lock(hashtext('squash:fix_runs:' || new.bug_id::text));
      if (select count(*) from public.fix_runs f where f.bug_id = new.bug_id) >= 50 then
        raise exception using message = 'fix_run_limit', errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.bug_id is distinct from old.bug_id
     or new.workspace_id is distinct from old.workspace_id
     or new.run_id is distinct from old.run_id
     or new.created_by is distinct from old.created_by
     or new.started_at is distinct from old.started_at then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  if new.status is not distinct from old.status then
    new.finished_at := old.finished_at;
  elsif old.status = 'running' then
    new.finished_at := now();
  else
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.fix_runs_guard() from public, anon, authenticated;

create or replace trigger fix_runs_guard
  before insert or update on public.fix_runs
  for each row execute function public.fix_runs_guard();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.fix_runs enable row level security;
alter table public.fix_runs force row level security;

drop policy if exists fix_runs_select on public.fix_runs;
create policy fix_runs_select on public.fix_runs
  for select to authenticated
  using (public.is_member(workspace_id));

drop policy if exists fix_runs_insert on public.fix_runs;
create policy fix_runs_insert on public.fix_runs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_member(workspace_id)
    and exists (
      select 1 from public.bugs b
      where b.id = fix_runs.bug_id and b.workspace_id = fix_runs.workspace_id
    )
    and (
      after_attachment_id is null
      or exists (
        select 1 from public.bug_attachments a
        where a.id = fix_runs.after_attachment_id and a.bug_id = fix_runs.bug_id
      )
    )
  );

-- USING sees the stored row: only the creator's running runs. WITH CHECK sees
-- the new row; fix_runs_guard has already made finished_at consistent.
drop policy if exists fix_runs_update on public.fix_runs;
create policy fix_runs_update on public.fix_runs
  for update to authenticated
  using (
    created_by = auth.uid()
    and status = 'running'
    and public.is_member(workspace_id)
  )
  with check (
    created_by = auth.uid()
    and public.is_member(workspace_id)
    and (
      after_attachment_id is null
      or exists (
        select 1 from public.bug_attachments a
        where a.id = fix_runs.after_attachment_id and a.bug_id = fix_runs.bug_id
      )
    )
  );

-- No delete policy: rows go away only with their bug (or workspace).

-- -----------------------------------------------------------------------------
-- Privileges. Supabase grants new public tables to anon/authenticated by
-- default: undo that. Only the evidence columns are client-updatable.
-- -----------------------------------------------------------------------------
revoke all on table public.fix_runs from public, anon, authenticated;
grant select, insert on table public.fix_runs to authenticated;
grant update (status, branch, commit_sha, pr_url, files_changed, additions, deletions, summary,
              after_attachment_id)
  on table public.fix_runs to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = 'fix_runs'
  ) then
    alter publication supabase_realtime add table public.fix_runs;
  end if;
end
$$;
