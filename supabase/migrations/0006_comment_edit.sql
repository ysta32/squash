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
-- Realtime: comments is in the supabase_realtime publication (all operations)
-- since 0001_init.sql. Its replica identity goes back to DEFAULT (primary key):
-- with FULL, the WAL and DELETE / UPDATE old-row images would keep the text of
-- edited and deleted comments. UPDATE payloads still carry the full new row;
-- DELETE payloads carry only the id (they cannot be filtered by bug_id anyway),
-- and clients drop deleted comments by id.
--
-- Comment text in the activity log: every 'commented' bug_events row stores the
-- comment body in its note. bug_events.comment_id (new, nullable) links new
-- events to their comment, and the SECURITY DEFINER comments_redact_events
-- trigger keeps that note in step: an edit sets it to the new body, a delete
-- sets it to NULL, so no member can read the old text from the activity log.
-- Events written before this migration have no comment_id; they are matched by
-- (bug_id, actor_id = author, type 'commented', note = old body). Over-matching
-- only touches events carrying the identical text. Existing events are NOT
-- rewritten here (their text equals a still-visible comment body); they are
-- redacted when their comment is next edited or deleted.
--
-- Re-runnable like 0001_init.sql.
-- =============================================================================

alter table public.comments add column if not exists edited_at timestamptz;
alter table public.comments replica identity default;

-- No FK: the comment row goes away on delete while its (redacted) event stays.
alter table public.bug_events add column if not exists comment_id uuid;
create index if not exists bug_events_comment_id_idx
  on public.bug_events (comment_id) where comment_id is not null;

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
-- Activity log: link 'commented' events to their comment; redact on edit/delete.
-- -----------------------------------------------------------------------------
create or replace function public.comments_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bug_events (bug_id, actor_id, type, note, comment_id)
  values (new.bug_id, coalesce(auth.uid(), new.author_id), 'commented', new.body, new.id);
  return null;
end;
$$;

revoke execute on function public.comments_events() from public, anon, authenticated;

-- AFTER, so it only runs for rows RLS let through. Never raises.
create or replace function public.comments_redact_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := case when tg_op = 'UPDATE' then new.body end;
begin
  update public.bug_events e
  set note = v_note,
      -- On delete, unlink the event so a later comment reusing this id can't reach it.
      comment_id = case when tg_op = 'DELETE' then null else e.comment_id end
  where e.type = 'commented'
    and e.bug_id = old.bug_id
    and (e.note is distinct from v_note or tg_op = 'DELETE')
    and ((e.comment_id = old.id and e.actor_id = old.author_id)
         or (e.comment_id is null and e.actor_id = old.author_id and e.note = old.body));
  return null;
end;
$$;

revoke execute on function public.comments_redact_events() from public, anon, authenticated;

-- Redacted notes must not survive in replication old-row images either.
alter table public.bug_events replica identity default;

create or replace trigger comments_redact_events
  after update of body or delete on public.comments
  for each row execute function public.comments_redact_events();

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
