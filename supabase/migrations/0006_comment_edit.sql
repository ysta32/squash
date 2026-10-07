-- =============================================================================
-- Squash — comment edit / delete
--
-- Additive only; nothing here rewrites or removes existing data.
--   * comments.edited_at (null until the body is first changed). The server owns
--     it: every change of `body` sets it to now(); clients cannot write it.
--   * Authors can edit the body of their own comments while they are a member of
--     the comment's workspace. Clients only hold UPDATE on the `body` column, and
--     the comments_guard trigger rejects any change to id / bug_id / author_id /
--     created_at from any role (service role included) with `immutable_field`.
--   * Authors (still a member) and the workspace owner can delete a comment.
--   * The comments_rate_limit BEFORE INSERT trigger from 0005_hardening.sql is
--     untouched. comments_guard also runs BEFORE INSERT, only to clear
--     edited_at (it never raises on insert).
--
-- Error codes added (see the list in 0001_init.sql):
--   immutable_field  now also raised by comment updates that change id, bug_id,
--                    author_id or created_at (clients cannot reach it: their
--                    column grant only covers `body`)
--
-- Leak check: for UPDATE / DELETE, Postgres applies the policy USING clause as a
-- row filter before any BEFORE trigger fires, so a non-author's update / delete
-- simply matches 0 rows and comments_guard never runs for them.
--
-- Realtime: comments already has replica identity full and is in the
-- supabase_realtime publication (all operations) since 0001_init.sql. With RLS,
-- DELETE payloads carry only the primary key and cannot be filtered by bug_id,
-- so clients drop deleted comments by id.
--
-- The 'commented' bug_events row written on insert keeps the original text in
-- its note; bug_events stays append-only.
--
-- Re-runnable like 0001_init.sql.
-- =============================================================================

alter table public.comments add column if not exists edited_at timestamptz;

-- -----------------------------------------------------------------------------
-- Guard: only `body` may change; edited_at follows body changes (null on insert).
-- -----------------------------------------------------------------------------
create or replace function public.comments_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- A new comment has never been edited, whatever the client sent. Never raises,
    -- so it reveals nothing before the insert's RLS WITH CHECK runs.
    new.edited_at := null;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.bug_id is distinct from old.bug_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.comments_guard() from public, anon, authenticated;

create or replace trigger comments_guard
  before insert or update on public.comments
  for each row execute function public.comments_guard();

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update to authenticated
  using (
    author_id = auth.uid()
    and exists (
      select 1 from public.bugs b
      where b.id = comments.bug_id and public.is_member(b.workspace_id)
    )
  )
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.bugs b
      where b.id = comments.bug_id and public.is_member(b.workspace_id)
    )
  );

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (exists (
    select 1 from public.bugs b
    where b.id = comments.bug_id
      and public.is_member(b.workspace_id)
      and (comments.author_id = auth.uid() or public.is_workspace_owner(b.workspace_id))
  ));

-- -----------------------------------------------------------------------------
-- Privileges: body is the only client-writable column.
-- -----------------------------------------------------------------------------
grant update (body) on table public.comments to authenticated;
grant delete on table public.comments to authenticated;
