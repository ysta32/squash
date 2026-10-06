-- =============================================================================
-- Squash — feature requests
--
-- Adds bugs.kind so a workspace can track feature requests next to bugs. Both
-- kinds share the bugs table, numbering, attachments, comments and activity log;
-- the client shows them under separate Bugs / Features tabs. Existing rows
-- become bugs. Re-runnable like 0001_init.sql.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'bug_kind') then
    create type public.bug_kind as enum ('bug', 'feature');
  end if;
end
$$;

alter table public.bugs add column if not exists kind public.bug_kind not null default 'bug';

-- Same as 0001_init.sql, plus: moving an item between Bugs and Features logs an
-- 'edited' event.
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
  return null;
end;
$$;
