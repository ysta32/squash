-- =============================================================================
-- Squash — initial schema (Postgres 15 / Supabase)
--
-- Run once via the Supabase SQL editor or `supabase db push`. Statements are
-- written to be re-runnable (create or replace / if not exists / drop policy if
-- exists) so a partially applied run can be completed safely.
--
-- Error codes the client can match on (raised as `raise exception using
-- message = '<code>', errcode = 'P0001'`, surfaced as error.message):
--   not_authenticated            RPC called without a signed-in user
--   not_owner                    owner-only RPC called by a non-owner (or unknown workspace)
--   not_member                   caller (or target user) is not a member of the workspace
--   invalid_code                 join_workspace: no workspace has that invite code
--   invalid_name                 create_workspace: name empty or longer than 60 chars
--   cannot_remove_owner          remove_member: target is the workspace owner
--   transfer_ownership_required  delete_account: caller owns a workspace with other members
--   immutable_field              direct UPDATE touched a protected column
--   member_limit                 workspace already has 10 members
--   workspace_limit              user already owns 5 workspaces
--   attachment_limit             bug already has 10 attachments
--   rate_limited                 more than 30 bugs filed by the user in the last 60 seconds
-- =============================================================================

-- Every SECURITY DEFINER function below must bypass RLS (all tables use FORCE
-- ROW LEVEL SECURITY, which applies even to the table owner). On Supabase the
-- `postgres` role has BYPASSRLS; refuse to run as anything that does not.
do $$
begin
  if not exists (
    select 1 from pg_roles r
    where r.rolname = current_user and (r.rolsuper or r.rolbypassrls)
  ) then
    raise exception '0001_init.sql must run as a role with BYPASSRLS (Supabase: postgres), current_user=%', current_user;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'member_role') then
    create type public.member_role as enum ('owner', 'member');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'bug_severity') then
    create type public.bug_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'bug_status') then
    create type public.bug_status as enum ('open', 'resolved');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'bug_event_type') then
    create type public.bug_event_type as enum ('filed', 'resolved', 'reopened', 'edited', 'commented');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Invite codes: 8 chars from A-Z2-9 without the ambiguous 0/O/1/I (32 symbols,
-- so `byte % 32` is unbiased). Randomness comes from gen_random_uuid() (core,
-- CSPRNG-backed); bytes 6 and 8 carry fixed version/variant bits and are skipped.
-- Defined before the workspaces table because it is that table's column default.
-- -----------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_positions constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10];
  v_bytes bytea;
  v_code text;
  v_pos int;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach v_pos in array v_positions loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_pos) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.workspaces w where w.invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
--
-- Attribution columns (bugs.filed_by, bugs.resolved_by, comments.author_id,
-- bug_events.actor_id) are plain `uuid` with NO foreign key to profiles: when a
-- user deletes their account their profile row disappears but the history they
-- authored must survive. The client renders "Deleted user" for ids that have no
-- matching profile. (ON DELETE SET NULL would violate NOT NULL / lose history;
-- ON DELETE RESTRICT would block account deletion.)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'User' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  avatar_color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default public.gen_invite_code()
    check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  next_bug_number int not null default 1 check (next_bug_number >= 1)
);
create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

create table if not exists public.bugs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 0 is a placeholder; bugs_set_number always overwrites it before the row is stored.
  number int not null default 0,
  title text not null check (char_length(title) <= 200),
  description text not null default '' check (char_length(description) <= 20000),
  transcript text check (transcript is null or char_length(transcript) <= 20000),
  severity public.bug_severity not null default 'medium',
  status public.bug_status not null default 'open',
  filed_by uuid not null, -- no FK: see attribution note above
  created_at timestamptz not null default now(),
  resolved_by uuid, -- no FK: see attribution note above
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 5000),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);
create index if not exists bugs_workspace_created_idx on public.bugs (workspace_id, created_at desc);
create index if not exists bugs_filed_by_created_idx on public.bugs (filed_by, created_at desc);

create table if not exists public.bug_attachments (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  width int not null check (width > 0),
  height int not null check (height > 0),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);
create index if not exists bug_attachments_bug_id_idx on public.bug_attachments (bug_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  author_id uuid not null, -- no FK: see attribution note above
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists comments_bug_created_idx on public.comments (bug_id, created_at);

create table if not exists public.bug_events (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  actor_id uuid not null, -- no FK: see attribution note above
  type public.bug_event_type not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists bug_events_bug_created_idx on public.bug_events (bug_id, created_at);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  );
$$;

-- First path segment of a storage object name as a uuid, or null when it is not
-- a uuid (so storage policies deny instead of erroring on a bad cast).
create or replace function public.storage_workspace_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- Internal: removes remaining storage.objects rows for a workspace. Not granted
-- to any client role. Deleting rows does NOT delete the underlying files; the
-- client deletes files through the Storage API before calling delete_workspace /
-- delete_account, so normally nothing remains here. Supabase guards direct
-- deletes on storage.objects (storage.protect_delete); the setting below opts in
-- for this transaction. If the guard still refuses, the RPC fails (instead of
-- silently orphaning files) and the client can retry the Storage API cleanup.
create or replace function public.purge_workspace_storage_rows(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'screenshots' and o.name like p_workspace_id::text || '/%'
  ) then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects o
    where o.bucket_id = 'screenshots' and o.name like p_workspace_id::text || '/%';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles: created on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_palette constant text[] := array[
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'
  ];
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'User'
  );
  insert into public.profiles (id, display_name, avatar_url, avatar_color)
  values (
    new.id,
    left(v_name, 80),
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', '')),
    v_palette[(mod(abs(hashtext(new.id::text)::bigint), 10) + 1)::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Workspaces: guard + limits
-- -----------------------------------------------------------------------------
-- owner_id / invite_code / next_bug_number may only change from inside this
-- file's SECURITY DEFINER code, which sets the transaction-local flag
-- `squash.rpc = on` (clients cannot call set_config through PostgREST) and runs
-- as the function owner, never as anon/authenticated.
create or replace function public.workspaces_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  if (new.owner_id is distinct from old.owner_id
      or new.invite_code is distinct from old.invite_code
      or new.next_bug_number is distinct from old.next_bug_number)
     and not (coalesce(current_setting('squash.rpc', true), '') = 'on'
              and current_user not in ('anon', 'authenticated')) then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger workspaces_guard_update
  before update on public.workspaces
  for each row execute function public.workspaces_guard_update();

create or replace function public.workspaces_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('squash:owner:' || new.owner_id::text));
  if (select count(*) from public.workspaces w
      where w.owner_id = new.owner_id and w.id <> new.id) >= 5 then
    raise exception using message = 'workspace_limit', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger workspaces_limit
  before insert or update of owner_id on public.workspaces
  for each row execute function public.workspaces_limit();

create or replace function public.members_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('squash:members:' || new.workspace_id::text));
  if (select count(*) from public.workspace_members m
      where m.workspace_id = new.workspace_id) >= 10 then
    raise exception using message = 'member_limit', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger members_limit
  before insert on public.workspace_members
  for each row execute function public.members_limit();

-- -----------------------------------------------------------------------------
-- Bugs: guard, numbering, rate limit, updated_at, events
-- -----------------------------------------------------------------------------
-- INSERT: server owns created_at/updated_at (the rate limit counts by
-- created_at) and an open bug carries no resolution data.
-- UPDATE: workspace_id/number/filed_by/created_at/id are immutable.
--   open -> resolved : resolved_by := auth.uid(), resolved_at := now()
--   resolved -> open : resolved_by/resolved_at := null; resolution_note is kept
--                      as sent by the client (the reopen note, or null)
--   status unchanged : resolved_by/resolved_at may not change
create or replace function public.bugs_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if new.status = 'open' then
      new.resolved_by := null;
      new.resolved_at := null;
    else
      new.resolved_by := coalesce(auth.uid(), new.resolved_by);
      new.resolved_at := now();
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.number is distinct from old.number
     or new.filed_by is distinct from old.filed_by
     or new.created_at is distinct from old.created_at then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_by := coalesce(auth.uid(), new.resolved_by);
      new.resolved_at := now();
    else
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
  elsif new.resolved_by is distinct from old.resolved_by
        or new.resolved_at is distinct from old.resolved_at then
    raise exception using message = 'immutable_field', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger bugs_guard
  before insert or update on public.bugs
  for each row execute function public.bugs_guard();

create or replace function public.bugs_set_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_prev text := current_setting('squash.rpc', true);
begin
  select w.next_bug_number into v_next
  from public.workspaces w
  where w.id = new.workspace_id
  for update;
  if v_next is null then
    raise exception using message = 'not_member', errcode = 'P0001';
  end if;
  perform set_config('squash.rpc', 'on', true);
  update public.workspaces w set next_bug_number = v_next + 1 where w.id = new.workspace_id;
  perform set_config('squash.rpc', coalesce(v_prev, 'off'), true);
  new.number := v_next;
  return new;
end;
$$;

create or replace trigger bugs_set_number
  before insert on public.bugs
  for each row execute function public.bugs_set_number();

create or replace function public.bugs_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('squash:bugs:' || new.filed_by::text));
  if (select count(*) from public.bugs b
      where b.filed_by = new.filed_by and b.created_at > now() - interval '60 seconds') >= 30 then
    raise exception using message = 'rate_limited', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger bugs_rate_limit
  before insert on public.bugs
  for each row execute function public.bugs_rate_limit();

create or replace function public.bugs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger bugs_updated_at
  before update on public.bugs
  for each row execute function public.bugs_updated_at();

-- actor = auth.uid(); for service-role/dashboard edits (no JWT) it falls back to
-- the filer so the NOT NULL actor_id never blocks maintenance.
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
     or new.severity is distinct from old.severity then
    insert into public.bug_events (bug_id, actor_id, type, note)
    values (new.id, v_actor, 'edited', null);
  end if;
  return null;
end;
$$;

create or replace trigger bugs_events
  after insert or update on public.bugs
  for each row execute function public.bugs_events();

-- -----------------------------------------------------------------------------
-- Comments / attachments triggers
-- -----------------------------------------------------------------------------
create or replace function public.comments_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bug_events (bug_id, actor_id, type, note)
  values (new.bug_id, coalesce(auth.uid(), new.author_id), 'commented', new.body);
  return null;
end;
$$;

create or replace trigger comments_events
  after insert on public.comments
  for each row execute function public.comments_events();

create or replace function public.attachments_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('squash:attachments:' || new.bug_id::text));
  if (select count(*) from public.bug_attachments a where a.bug_id = new.bug_id) >= 10 then
    raise exception using message = 'attachment_limit', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger attachments_limit
  before insert on public.bug_attachments
  for each row execute function public.attachments_limit();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_ws public.workspaces;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception using message = 'invalid_name', errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('squash:owner:' || v_uid::text));
  if (select count(*) from public.workspaces w where w.owner_id = v_uid) >= 5 then
    raise exception using message = 'workspace_limit', errcode = 'P0001';
  end if;
  insert into public.workspaces (name, owner_id)
  values (v_name, v_uid)
  returning * into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_uid, 'owner');
  return v_ws;
end;
$$;

create or replace function public.join_workspace(p_code text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_ws public.workspaces;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  select w.* into v_ws from public.workspaces w where w.invite_code = v_code;
  if not found then
    raise exception using message = 'invalid_code', errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('squash:members:' || v_ws.id::text));
  if exists (select 1 from public.workspace_members m
             where m.workspace_id = v_ws.id and m.user_id = v_uid) then
    return v_ws;
  end if;
  if (select count(*) from public.workspace_members m where m.workspace_id = v_ws.id) >= 10 then
    raise exception using message = 'member_limit', errcode = 'P0001';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_uid, 'member');
  return v_ws;
end;
$$;

-- Public (anon) preview for /join/:code. Returns no rows for an unknown code.
create or replace function public.workspace_preview(p_code text)
returns table (id uuid, name text, member_count int)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id)::int
  from public.workspaces w
  where w.invite_code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
$$;

create or replace function public.regenerate_invite_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.workspaces w
                 where w.id = p_workspace_id and w.owner_id = auth.uid()) then
    raise exception using message = 'not_owner', errcode = 'P0001';
  end if;
  v_code := public.gen_invite_code();
  perform set_config('squash.rpc', 'on', true);
  update public.workspaces w set invite_code = v_code where w.id = p_workspace_id;
  perform set_config('squash.rpc', 'off', true);
  return v_code;
end;
$$;

create or replace function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  select w.owner_id into v_owner from public.workspaces w where w.id = p_workspace_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception using message = 'not_owner', errcode = 'P0001';
  end if;
  if p_user_id = v_owner then
    raise exception using message = 'cannot_remove_owner', errcode = 'P0001';
  end if;
  delete from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id;
end;
$$;

create or replace function public.transfer_ownership(p_workspace_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  select w.owner_id into v_owner from public.workspaces w where w.id = p_workspace_id for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception using message = 'not_owner', errcode = 'P0001';
  end if;
  if p_new_owner = v_owner then
    return;
  end if;
  if not exists (select 1 from public.workspace_members m
                 where m.workspace_id = p_workspace_id and m.user_id = p_new_owner) then
    raise exception using message = 'not_member', errcode = 'P0001';
  end if;
  -- 5-owned cap for the new owner (also enforced, under the same lock, by the
  -- workspaces_limit trigger on update of owner_id).
  perform pg_advisory_xact_lock(hashtext('squash:owner:' || p_new_owner::text));
  if (select count(*) from public.workspaces w where w.owner_id = p_new_owner) >= 5 then
    raise exception using message = 'workspace_limit', errcode = 'P0001';
  end if;
  perform set_config('squash.rpc', 'on', true);
  update public.workspaces w set owner_id = p_new_owner where w.id = p_workspace_id;
  perform set_config('squash.rpc', 'off', true);
  update public.workspace_members m set role = 'member'
  where m.workspace_id = p_workspace_id and m.user_id = v_owner;
  update public.workspace_members m set role = 'owner'
  where m.workspace_id = p_workspace_id and m.user_id = p_new_owner;
end;
$$;

-- Storage files: the client MUST delete the workspace's files via the Storage
-- API (storage.from('screenshots').remove(...)) BEFORE calling this RPC —
-- deleting storage.objects rows from SQL does not remove the files themselves.
-- This RPC then removes any remaining storage.objects rows and the workspace
-- (members, bugs, attachments, comments and events cascade).
create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.workspaces w
                 where w.id = p_workspace_id and w.owner_id = auth.uid()) then
    raise exception using message = 'not_owner', errcode = 'P0001';
  end if;
  perform public.purge_workspace_storage_rows(p_workspace_id);
  delete from public.workspaces w where w.id = p_workspace_id;
end;
$$;

-- Fails with transfer_ownership_required if the caller owns a workspace that has
-- other members. Otherwise deletes the caller's (solo) owned workspaces —
-- including their remaining storage.objects rows; as with delete_workspace the
-- client MUST first delete those files via the Storage API — and then the
-- auth.users row, which cascades to profiles and workspace_members. Authored
-- bugs/comments/events remain (no FK on attribution columns).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ws_id uuid;
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('squash:owner:' || v_uid::text));
  if exists (
    select 1 from public.workspaces w
    where w.owner_id = v_uid
      and (select count(*) from public.workspace_members m where m.workspace_id = w.id) > 1
  ) then
    raise exception using message = 'transfer_ownership_required', errcode = 'P0001';
  end if;
  for v_ws_id in select w.id from public.workspaces w where w.owner_id = v_uid loop
    perform public.purge_workspace_storage_rows(v_ws_id);
    delete from public.workspaces w where w.id = v_ws_id;
  end loop;
  delete from auth.users u where u.id = v_uid;
end;
$$;

create or replace function public.workspace_stats(p_workspace_id uuid)
returns table (user_id uuid, filed_total int, resolved_total int, filed_7d int, resolved_7d int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_workspace_id) then
    raise exception using message = 'not_member', errcode = 'P0001';
  end if;
  return query
  select m.user_id,
         (select count(*) from public.bugs b
          where b.workspace_id = p_workspace_id and b.filed_by = m.user_id)::int,
         (select count(*) from public.bugs b
          where b.workspace_id = p_workspace_id and b.resolved_by = m.user_id)::int,
         (select count(*) from public.bugs b
          where b.workspace_id = p_workspace_id and b.filed_by = m.user_id
            and b.created_at > now() - interval '7 days')::int,
         (select count(*) from public.bugs b
          where b.workspace_id = p_workspace_id and b.resolved_by = m.user_id
            and b.resolved_at > now() - interval '7 days')::int
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
  order by m.joined_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.bugs enable row level security;
alter table public.bugs force row level security;
alter table public.bug_attachments enable row level security;
alter table public.bug_attachments force row level security;
alter table public.comments enable row level security;
alter table public.comments force row level security;
alter table public.bug_events enable row level security;
alter table public.bug_events force row level security;

-- profiles: self, or anyone sharing a workspace; update own row only.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members m1
      join public.workspace_members m2 on m2.workspace_id = m1.workspace_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- workspaces: members read; owner renames (other columns guarded by trigger).
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (public.is_member(id));

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- workspace_members: members read; writes via RPCs only.
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (public.is_member(workspace_id));

-- bugs: members read/insert/update; no delete (history is kept).
drop policy if exists bugs_select on public.bugs;
create policy bugs_select on public.bugs
  for select to authenticated
  using (public.is_member(workspace_id));

drop policy if exists bugs_insert on public.bugs;
create policy bugs_insert on public.bugs
  for insert to authenticated
  with check (
    public.is_member(workspace_id)
    and filed_by = auth.uid()
    and status = 'open'
    and resolved_by is null
  );

-- resolved_by/resolved_at consistency is enforced by the bugs_guard trigger.
drop policy if exists bugs_update on public.bugs;
create policy bugs_update on public.bugs
  for update to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

-- bug_attachments: members of the bug's workspace.
drop policy if exists bug_attachments_select on public.bug_attachments;
create policy bug_attachments_select on public.bug_attachments
  for select to authenticated
  using (exists (
    select 1 from public.bugs b
    where b.id = bug_attachments.bug_id and public.is_member(b.workspace_id)
  ));

drop policy if exists bug_attachments_insert on public.bug_attachments;
create policy bug_attachments_insert on public.bug_attachments
  for insert to authenticated
  with check (exists (
    select 1 from public.bugs b
    where b.id = bug_attachments.bug_id
      and public.is_member(b.workspace_id)
      and bug_attachments.storage_path like b.workspace_id::text || '/' || b.id::text || '/%'
  ));

drop policy if exists bug_attachments_delete on public.bug_attachments;
create policy bug_attachments_delete on public.bug_attachments
  for delete to authenticated
  using (exists (
    select 1 from public.bugs b
    where b.id = bug_attachments.bug_id and public.is_member(b.workspace_id)
  ));

-- comments: members read; members insert as themselves; immutable.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (exists (
    select 1 from public.bugs b
    where b.id = comments.bug_id and public.is_member(b.workspace_id)
  ));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.bugs b
      where b.id = comments.bug_id and public.is_member(b.workspace_id)
    )
  );

-- bug_events: members read; append-only, written only by SECURITY DEFINER triggers.
drop policy if exists bug_events_select on public.bug_events;
create policy bug_events_select on public.bug_events
  for select to authenticated
  using (exists (
    select 1 from public.bugs b
    where b.id = bug_events.bug_id and public.is_member(b.workspace_id)
  ));

-- -----------------------------------------------------------------------------
-- Table privileges (defense in depth on top of RLS; RLS does not cover TRUNCATE)
-- -----------------------------------------------------------------------------
revoke all on table public.profiles, public.workspaces, public.workspace_members, public.bugs,
  public.bug_attachments, public.comments, public.bug_events from anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;
grant select, insert, update on table public.bugs to authenticated;
grant select, insert, delete on table public.bug_attachments to authenticated;
grant select, insert on table public.comments to authenticated;
grant select on table public.bug_events to authenticated;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.purge_workspace_storage_rows(uuid) from authenticated;
grant execute on function public.workspace_preview(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private screenshots bucket, objects at <workspace_id>/<bug_id>/<file>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict do nothing;

drop policy if exists screenshots_select on storage.objects;
create policy screenshots_select on storage.objects
  for select to authenticated
  using (bucket_id = 'screenshots' and public.is_member(public.storage_workspace_id(name)));

drop policy if exists screenshots_insert on storage.objects;
create policy screenshots_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'screenshots' and public.is_member(public.storage_workspace_id(name)));

-- Restrictive: uploads into the bucket must target <workspace_id>/<bug_id>/<file>
-- where the bug exists in that workspace (other buckets are unaffected).
drop policy if exists screenshots_insert_bug_path on storage.objects;
create policy screenshots_insert_bug_path on storage.objects
  as restrictive
  for insert to authenticated
  with check (
    bucket_id <> 'screenshots'
    or (
      split_part(objects.name, '/', 3) <> ''
      and exists (
        select 1 from public.bugs b
        where b.workspace_id = public.storage_workspace_id(objects.name)
          and b.id::text = split_part(objects.name, '/', 2)
          and public.is_member(b.workspace_id)
      )
    )
  );

drop policy if exists screenshots_delete on storage.objects;
create policy screenshots_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots' and public.is_member(public.storage_workspace_id(name)));

-- -----------------------------------------------------------------------------
-- Realtime: full row images so UPDATE/DELETE payloads carry workspace_id/bug_id.
-- -----------------------------------------------------------------------------
alter table public.bugs replica identity full;
alter table public.bug_events replica identity full;
alter table public.comments replica identity full;
alter table public.bug_attachments replica identity full;
alter table public.workspaces replica identity full;
alter table public.workspace_members replica identity full;

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach v_table in array array['bugs', 'bug_events', 'comments', 'bug_attachments',
                                 'workspaces', 'workspace_members'] loop
    if not exists (
      select 1 from pg_publication_tables pt
      where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;
