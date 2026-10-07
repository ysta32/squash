-- =============================================================================
-- Squash — assignees
--
-- A bug (or feature request) can be assigned to one member of its workspace.
-- bugs.assignee_id is a plain uuid with no FK, like the other attribution
-- columns (see the attribution note in 0001_init.sql). Invariants:
--   * when set, the assignee is a current member of the bug's workspace
--     (bugs_assignee_guard raises `assignee_not_member`, errcode P0001);
--   * removing a member (remove_member, delete_account, cascades) clears their
--     assignments in that workspace (workspace_members_clear_assignments);
--   * every change logs an 'assigned' event whose note is the new assignee id
--     as text, or null when unassigned. Assignment changes never log 'edited'.
-- assignee_id is not an immutable field: bugs_guard does not look at it, and
-- the existing bugs_update policy / table-level UPDATE grant cover it.
--
-- Error codes added (see the list in 0001_init.sql):
--   assignee_not_member  assignee is not a member of the bug's workspace (also
--                        raised when the caller is not a member, so outsiders
--                        cannot probe membership through this check)
--
-- ALTER TYPE ... ADD VALUE may run inside a transaction (Postgres 12+), but the
-- new value cannot be used until that transaction commits. It is only referenced
-- from plpgsql bodies below, which are not validated at create time and only run
-- after this migration has committed. Re-runnable like 0001_init.sql.
-- =============================================================================

alter type public.bug_event_type add value if not exists 'assigned';

alter table public.bugs add column if not exists assignee_id uuid; -- no FK: see attribution note in 0001_init.sql

create index if not exists bugs_workspace_assignee_idx
  on public.bugs (workspace_id, assignee_id)
  where assignee_id is not null;

-- BEFORE INSERT / UPDATE OF assignee_id. Fires before bugs_guard (triggers run
-- in name order) and before RLS WITH CHECK. SECURITY DEFINER so the member
-- lookup sees every workspace_members row regardless of the caller's RLS.
-- FOR KEY SHARE on the member row makes a concurrent removal of that member wait
-- for this transaction; its cleanup trigger then runs with a fresh snapshot and
-- clears the assignment made here. Conversely, if the removal commits first the
-- locking read finds no row and the assignment is rejected. These are leaf row
-- locks (bug row, then member row) taken outside the RPC lock order; the reverse
-- order (member delete, then bug rows) can only meet it in a multi-row update
-- racing a removal, which the deadlock detector resolves by aborting one side.
create or replace function public.bugs_assignee_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  -- Uniform error for callers outside the workspace (no membership oracle).
  -- auth.uid() is null for service-role / dashboard edits, which skip this.
  if auth.uid() is not null and not public.is_member(new.workspace_id) then
    raise exception using message = 'assignee_not_member', errcode = 'P0001';
  end if;
  perform 1 from public.workspace_members m
  where m.workspace_id = new.workspace_id and m.user_id = new.assignee_id
  for key share;
  if not found then
    raise exception using message = 'assignee_not_member', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger bugs_assignee_guard
  before insert or update of assignee_id on public.bugs
  for each row execute function public.bugs_assignee_guard();

-- Same as 0002_bug_kind.sql, plus: an assignee change logs an 'assigned' event
-- (note = new assignee id, or null when unassigned). assignee_id is deliberately
-- not part of the 'edited' check. v_actor falls back to resolved_by/filed_by so
-- the NOT NULL actor_id holds for service-role edits and for the member-removal
-- cleanup below when no JWT is present.
create or replace function public.bugs_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, coalesce(auth.uid(), new.filed_by), 'filed', null);
    if new.assignee_id is not null then
      insert into public.bug_events (bug_id, actor_id, type, note)
      values (new.id, coalesce(auth.uid(), new.filed_by), 'assigned', new.assignee_id::text);
    end if;
    return null;
  end if;

  v_actor := coalesce(auth.uid(), new.resolved_by, new.filed_by);
  if old.status = 'open' and new.status = 'resolved' then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, v_actor, 'resolved', new.resolution_note);
  elsif old.status = 'resolved' and new.status = 'open' then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, v_actor, 'reopened', new.resolution_note);
  end if;
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.severity is distinct from old.severity
     or new.kind is distinct from old.kind then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, v_actor, 'edited', null);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, v_actor, 'assigned', new.assignee_id::text);
  end if;
  return null;
end;
$$;

-- AFTER DELETE on workspace_members: unassign the removed user's bugs in that
-- workspace. Runs as the definer (BYPASSRLS) so it works from remove_member,
-- delete_account and FK cascades alike. Only assignee_id (and updated_at, via
-- bugs_updated_at) changes, so bugs_guard allows it; bugs_assignee_guard skips
-- nulls; bugs_events logs 'assigned' with a null note and a non-null actor
-- (auth.uid(), else resolved_by, else filed_by). When the whole workspace is
-- being deleted its row is already gone and the bugs cascade away, so skip.
create or replace function public.workspace_members_clear_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    return null;
  end if;
  update public.bugs b
  set assignee_id = null
  where b.workspace_id = old.workspace_id and b.assignee_id = old.user_id;
  return null;
end;
$$;

create or replace trigger workspace_members_clear_assignments
  after delete on public.workspace_members
  for each row execute function public.workspace_members_clear_assignments();

-- Trigger functions are never called directly; keep them off the RPC surface.
revoke execute on function public.bugs_assignee_guard() from public, anon, authenticated;
revoke execute on function public.workspace_members_clear_assignments() from public, anon, authenticated;
