-- =============================================================================
-- Squash — hardening
--
-- Additive only; nothing here rewrites or removes existing data.
--   * Deleting a bug (or feature request) is limited to the member who filed it
--     and the workspace owner (replaces the members-can-delete policy of
--     0003_bug_delete.sql, by name, so re-running 0001..0005 in order always
--     ends with this policy).
--   * public.bug_deletions keeps a record of every deleted bug: number, title,
--     kind, who deleted it and when. Members of the workspace can read it;
--     clients can never write it. Rows are written only by the SECURITY DEFINER
--     bugs_log_deletion trigger and go away with their workspace.
--   * Comments are rate limited like bugs: more than 30 comments by the same
--     author in 60 seconds raises `rate_limited`.
--   * Indexes for the list filters (status / kind within a workspace) and for
--     the comment rate limit.
--
-- Error codes added (see the list in 0001_init.sql):
--   rate_limited  now also raised by comment inserts: the author already posted
--                 30 comments in the last 60 seconds
--
-- Lock order: the comment rate limit takes the per-author advisory lock
-- 'squash:comments:<author_id>' and nothing else, so it cannot join a cycle with
-- the RPC lock order in 0001_init.sql. A bug delete that races a delete of its
-- workspace can deadlock (bug row, then the workspace key-share lock taken by
-- the bug_deletions FK check, against workspace row, then bug row); Postgres
-- aborts one side and the client reports a failed delete.
--
-- Index builds take a SHARE lock on bugs / comments (writes wait, reads do not)
-- for the duration of the build. Re-runnable like 0001_init.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_id = auth.uid()
  );
$$;

revoke execute on function public.is_workspace_owner(uuid) from public, anon;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Bug delete: filer or workspace owner (and still a member of the workspace)
-- -----------------------------------------------------------------------------
drop policy if exists bugs_delete on public.bugs;
create policy bugs_delete on public.bugs
  for delete to authenticated
  using (
    public.is_member(workspace_id)
    and (filed_by = auth.uid() or public.is_workspace_owner(workspace_id))
  );

grant delete on table public.bugs to authenticated;

-- -----------------------------------------------------------------------------
-- Deletion log
-- -----------------------------------------------------------------------------
create table if not exists public.bug_deletions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  bug_number int not null,
  title text not null,
  kind public.bug_kind not null,
  -- null when deleted without a signed-in user (service role / dashboard).
  deleted_by uuid, -- no FK: see attribution note in 0001_init.sql
  deleted_at timestamptz not null default now()
);
create index if not exists bug_deletions_workspace_deleted_idx
  on public.bug_deletions (workspace_id, deleted_at desc);

alter table public.bug_deletions enable row level security;
alter table public.bug_deletions force row level security;

drop policy if exists bug_deletions_select on public.bug_deletions;
create policy bug_deletions_select on public.bug_deletions
  for select to authenticated
  using (public.is_member(workspace_id));

-- Supabase grants new public tables to anon/authenticated by default: undo that.
revoke all on table public.bug_deletions from public, anon, authenticated;
grant select on table public.bug_deletions to authenticated;

-- AFTER DELETE so only rows that RLS actually let through are logged. When the
-- whole workspace is being deleted (delete_workspace, delete_account, owner
-- cascade) its row is already gone by the time the bugs cascade: nothing to log,
-- and inserting would violate the workspace FK.
create or replace function public.bugs_log_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    return null;
  end if;
  insert into public.bug_deletions (workspace_id, bug_number, title, kind, deleted_by, deleted_at)
  values (old.workspace_id, old.number, old.title, old.kind, auth.uid(), now());
  return null;
end;
$$;

revoke execute on function public.bugs_log_deletion() from public, anon, authenticated;

create or replace trigger bugs_log_deletion
  after delete on public.bugs
  for each row execute function public.bugs_log_deletion();

-- -----------------------------------------------------------------------------
-- Comment rate limit: 30 per author per 60 seconds
-- -----------------------------------------------------------------------------
create index if not exists comments_author_created_idx on public.comments (author_id, created_at);

-- BEFORE INSERT, so it runs before the RLS WITH CHECK. Counts the comments table
-- itself (no separate log): deleting a bug removes its comments and so frees up
-- that author's budget, which is acceptable for a per-minute limit. The server
-- owns comments.created_at from now on (as bugs_guard does for bugs), so a
-- client cannot backdate comments to slip under the limit.
-- The limit is only checked for a signed-in member commenting as themselves.
-- Any other insert (spoofed author_id, outsider, missing bug) is left for the
-- RLS WITH CHECK to reject, so the error never depends on another user's count
-- (no cross-workspace oracle) and nobody can take another user's lock.
-- Inserts without a signed-in user (service role / dashboard) are not limited.
create or replace function public.comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  if auth.uid() is null or new.author_id is distinct from auth.uid()
     or not exists (select 1 from public.bugs b
                    where b.id = new.bug_id and public.is_member(b.workspace_id)) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('squash:comments:' || new.author_id::text));
  if (select count(*) from public.comments c
      where c.author_id = new.author_id and c.created_at > now() - interval '60 seconds') >= 30 then
    raise exception using message = 'rate_limited', errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.comments_rate_limit() from public, anon, authenticated;

create or replace trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.comments_rate_limit();

-- -----------------------------------------------------------------------------
-- List indexes
-- -----------------------------------------------------------------------------
create index if not exists bugs_workspace_status_created_idx
  on public.bugs (workspace_id, status, created_at desc);
create index if not exists bugs_workspace_kind_created_idx
  on public.bugs (workspace_id, kind, created_at desc);
