-- Squash RLS / limits test suite. Run AFTER every file in supabase/migrations/, against a fresh/scratch project:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- The whole script runs in one transaction and ends with ROLLBACK, so nothing persists.
-- Fake users (ids 10000000-0000-0000-0000-0000000000NN): 01=A owner of "WS One", 02=B member, 03=C outsider,
-- 04..11 extra joiners, 12 = 11th member (rejected), 13 = workspace-limit user, 14 = rate-limit user.
-- Any failed assertion raises 'FAIL[n]: ...' and aborts (ON_ERROR_STOP); success prints ALL RLS TESTS PASSED.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
\set as_a 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}'', true); set local role authenticated;'
\set as_b 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}'', true); set local role authenticated;'
\set as_c 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}'', true); set local role authenticated;'
\set as_u12 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000012","role":"authenticated"}'', true); set local role authenticated;'
\set as_w 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000013","role":"authenticated"}'', true); set local role authenticated;'
\set as_r 'reset role; select set_config(''request.jwt.claims'', ''{"sub":"10000000-0000-0000-0000-000000000014","role":"authenticated"}'', true); set local role authenticated;'
\set as_anon 'reset role; select set_config(''request.jwt.claims'', ''{"role":"anon"}'', true); set local role anon;'
\set as_pg 'reset role;'

begin;

-- ===== Setup (as postgres): 14 fake auth users; signup trigger must create profiles =====
:as_pg
insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'rlstest' || g || '@example.test',
       case when g = 1 then '{"full_name":"Alice Test"}'::jsonb else '{}'::jsonb end,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from generate_series(1, 14) g;

-- [1] handle_new_user creates profiles; [2] display_name from full_name, else email local part
do $$ begin
  if (select count(*) from public.profiles where id::text like '10000000-0000-0000-0000-%') <> 14 then
    raise exception 'FAIL[1]: signup trigger did not create 14 profiles'; end if;
  if (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001') <> 'Alice Test' then
    raise exception 'FAIL[2]: display_name should come from full_name'; end if;
  if (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000002') <> 'rlstest2' then
    raise exception 'FAIL[2]: display_name should fall back to email local part'; end if;
end $$;

-- ===== Workspace creation / invite code (as A) =====
:as_a
do $$ declare w public.workspaces; begin
  w := public.create_workspace('WS One');
  perform set_config('t.ws1', w.id::text, true);
  perform set_config('t.code', w.invite_code, true);
  -- [3] invite code format
  if w.invite_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'FAIL[3]: invite_code % not 8 chars from unambiguous alphabet', w.invite_code; end if;
  -- [4] owner member row exists
  if not exists (select 1 from public.workspace_members where workspace_id = w.id and user_id = '10000000-0000-0000-0000-000000000001' and role = 'owner') then
    raise exception 'FAIL[4]: owner member row missing'; end if;
end $$;

-- ===== join_workspace =====
:as_c
-- [5] bad code
do $$ begin
  begin
    perform public.join_workspace('ZZZZZZZZ');
    raise exception 'FAIL[5]: bad invite code was accepted';
  exception when others then if sqlerrm <> 'invalid_code' then raise; end if;
  end;
end $$;

:as_anon
-- [6] workspace_preview callable by anon, returns name + member_count
do $$ declare r record; begin
  select * into r from public.workspace_preview(current_setting('t.code'));
  if r.name is distinct from 'WS One' or r.member_count <> 1 then
    raise exception 'FAIL[6]: workspace_preview anon result wrong'; end if;
end $$;

:as_b
-- [7] join works and is idempotent
do $$ declare w public.workspaces; begin
  w := public.join_workspace(current_setting('t.code'));
  w := public.join_workspace(current_setting('t.code'));
  if (select count(*) from public.workspace_members where workspace_id = w.id) <> 2 then
    raise exception 'FAIL[7]: join_workspace not idempotent / member count wrong'; end if;
end $$;

-- ===== A files bug1; B comments/edits/resolves/reopens =====
:as_a
do $$ declare bid uuid; n int; begin
  insert into public.bugs (workspace_id, title, description, severity, filed_by)
    values (current_setting('t.ws1')::uuid, 'First bug', 'desc', 'medium', '10000000-0000-0000-0000-000000000001') returning id, number into bid, n;
  perform set_config('t.bug1', bid::text, true);
  -- [8] number assigned by trigger starting at 1
  if n <> 1 then raise exception 'FAIL[8]: first bug number should be 1, got %', n; end if;
end $$;

-- [9] filed_by spoofing rejected
do $$ begin
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by)
      values (current_setting('t.ws1')::uuid, 'Spoof', 'x', 'low', '10000000-0000-0000-0000-000000000002');
    raise exception 'FAIL[9]: filed_by spoofing accepted';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;

-- [10] inserting an already-resolved bug rejected
do $$ begin
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by, status)
      values (current_setting('t.ws1')::uuid, 'Pre-resolved', 'x', 'low', '10000000-0000-0000-0000-000000000001', 'resolved');
    raise exception 'FAIL[10]: insert with status=resolved accepted';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;

:as_b
do $$ declare b uuid := current_setting('t.bug1')::uuid; begin
  insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000002', 'a comment');
  update public.bugs set title = 'First bug (edited)' where id = b;
  update public.bugs set status = 'resolved', resolution_note = 'fixed it' where id = b;
  -- [11] resolved_by/resolved_at forced consistent on resolve
  if (select resolved_by from public.bugs where id = b) is distinct from '10000000-0000-0000-0000-000000000002'::uuid
     or (select resolved_at from public.bugs where id = b) is null then
    raise exception 'FAIL[11]: resolved_by/resolved_at not set on resolve'; end if;
  update public.bugs set status = 'open', resolution_note = 'still broken' where id = b;
  -- [12] reopen clears resolver
  if (select resolved_by from public.bugs where id = b) is not null
     or (select resolved_at from public.bugs where id = b) is not null then
    raise exception 'FAIL[12]: resolved_by/resolved_at not cleared on reopen'; end if;
end $$;

-- [13] comment author spoofing rejected
do $$ begin
  begin
    insert into public.comments (bug_id, author_id, body) values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000001', 'spoof');
    raise exception 'FAIL[13]: comments.author_id spoofing accepted';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;

-- [14] bug_events rows exist for filed/edited/commented/resolved/reopened; [15] actor + note recorded
do $$ declare t text; begin
  foreach t in array array['filed','edited','commented','resolved','reopened'] loop
    if not exists (select 1 from public.bug_events where bug_id = current_setting('t.bug1')::uuid and type = t::public.bug_event_type) then
      raise exception 'FAIL[14]: missing bug_events row of type %', t; end if;
  end loop;
  if not exists (select 1 from public.bug_events where bug_id = current_setting('t.bug1')::uuid and type = 'resolved' and actor_id = '10000000-0000-0000-0000-000000000002' and note = 'fixed it') then
    raise exception 'FAIL[15]: resolved event should have actor B and note "fixed it"'; end if;
end $$;

-- ===== bug_events append-only for members (as B) =====
-- [16] cannot update, [17] cannot delete
do $$ declare n int; begin
  begin update public.bug_events set note = 'tamper' where bug_id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[16]: member updated bug_events'; end if;
  begin delete from public.bug_events where bug_id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[17]: member deleted bug_events'; end if;
end $$;
-- [18] cannot insert
do $$ begin
  begin
    insert into public.bug_events (bug_id, actor_id, type) values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000002', 'filed');
    raise exception 'FAIL[18]: member inserted bug_events';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;
-- [19] members can delete a bug (0003_bug_delete.sql); attachments, comments and events cascade
do $$ declare b uuid; n int; begin
  insert into public.bugs (workspace_id, title, description, severity, filed_by)
    values (current_setting('t.ws1')::uuid, 'Doomed', 'x', 'low', '10000000-0000-0000-0000-000000000002')
    returning id into b;
  insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000002', 'bye');
  delete from public.bugs where id = b; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[19]: member could not delete a bug'; end if;
  if exists (select 1 from public.bug_events where bug_id = b)
     or exists (select 1 from public.comments where bug_id = b) then
    raise exception 'FAIL[19]: deleted bug left comments/events behind'; end if;
end $$;
-- [20] bugs.filed_by cannot be changed
do $$ begin
  begin
    update public.bugs set filed_by = '10000000-0000-0000-0000-000000000002' where id = current_setting('t.bug1')::uuid;
  exception when others then null;
  end;
  if (select filed_by from public.bugs where id = current_setting('t.bug1')::uuid) <> '10000000-0000-0000-0000-000000000001' then
    raise exception 'FAIL[20]: filed_by was changed'; end if;
end $$;
-- [21] non-owner cannot rename workspace; [22] cannot add members directly
do $$ declare n int; begin
  begin update public.workspaces set name = 'Hijack' where id = current_setting('t.ws1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[21]: non-owner renamed workspace'; end if;
  begin
    insert into public.workspace_members (workspace_id, user_id, role) values (current_setting('t.ws1')::uuid, '10000000-0000-0000-0000-000000000003', 'member');
    raise exception 'FAIL[22]: direct workspace_members insert accepted';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;
-- [23] non-owner cannot regenerate code; [24] cannot remove owner
do $$ begin
  begin
    perform public.regenerate_invite_code(current_setting('t.ws1')::uuid);
    raise exception 'FAIL[23]: non-owner regenerated invite code';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if;
  end;
  begin
    perform public.remove_member(current_setting('t.ws1')::uuid, '10000000-0000-0000-0000-000000000001');
    raise exception 'FAIL[24]: non-owner removed a member';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if;
  end;
end $$;
-- [25] profiles: co-member visible but not updatable
do $$ declare n int; begin
  if not exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL[25]: co-member profile not visible'; end if;
  begin update public.profiles set display_name = 'pwned' where id = '10000000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[25]: updated another user''s profile'; end if;
end $$;
-- [53] own profile: id not writable (column grant); [54] avatar CHECKs enforced; own name update works
do $$ declare n int; begin
  begin
    update public.profiles set id = '10000000-0000-0000-0000-000000000099' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'FAIL[53]: profile id was writable';
  exception when sqlstate '42501' then null; end;
  begin
    update public.profiles set avatar_color = 'red' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'FAIL[54]: invalid avatar_color accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set avatar_url = 'javascript:alert(1)' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'FAIL[54]: non-https avatar_url accepted';
  exception when check_violation then null; end;
  update public.profiles set display_name = 'Bob', avatar_color = '#AbCdEf' where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[54]: own profile update failed'; end if;
end $$;

-- ===== Owner capabilities (as A) =====
:as_a
-- [26] owner can rename; [27] owner cannot change invite_code directly
do $$ declare n int; begin
  update public.workspaces set name = 'WS One Renamed' where id = current_setting('t.ws1')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[26]: owner could not rename workspace'; end if;
  begin
    update public.workspaces set invite_code = 'AAAAAAAA' where id = current_setting('t.ws1')::uuid;
  exception when others then null;
  end;
  if (select invite_code from public.workspaces where id = current_setting('t.ws1')::uuid) <> current_setting('t.code') then
    raise exception 'FAIL[27]: invite_code changed by direct update'; end if;
end $$;

-- ===== Attachments: 10 per bug max =====
do $$ declare bid uuid; ws uuid := current_setting('t.ws1')::uuid; i int; begin
  insert into public.bugs (workspace_id, title, description, severity, filed_by)
    values (ws, 'Attachment bug', 'x', 'low', '10000000-0000-0000-0000-000000000001') returning id into bid;
  for i in 1..10 loop
    insert into public.bug_attachments (bug_id, storage_path, width, height, size_bytes)
      values (bid, ws || '/' || bid || '/' || i || '.webp', 100, 100, 1000);
  end loop;
  begin
    insert into public.bug_attachments (bug_id, storage_path, width, height, size_bytes)
      values (bid, ws || '/' || bid || '/11.webp', 100, 100, 1000);
    raise exception 'FAIL[28]: 11th attachment accepted';
  exception when others then if sqlerrm <> 'attachment_limit' then raise; end if;
  end;
end $$;

-- [29] storage: member can insert into screenshots/<ws>/...
do $$ begin
  insert into storage.objects (bucket_id, name)
    values ('screenshots', current_setting('t.ws1') || '/' || current_setting('t.bug1') || '/shot.webp');
end $$;

-- ===== Member limit: 10 max (A, B + users 04..11); 12th rejected =====
do $$ declare i int; begin
  for i in 4..11 loop
    perform set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-0000-0000-' || lpad(i::text, 12, '0'), 'role', 'authenticated')::text, true);
    perform public.join_workspace(current_setting('t.code'));
  end loop;
end $$;
:as_a
-- [30] exactly 10 members now
do $$ begin
  if (select count(*) from public.workspace_members where workspace_id = current_setting('t.ws1')::uuid) <> 10 then
    raise exception 'FAIL[30]: expected 10 members'; end if;
end $$;
:as_u12
-- [31] 11th member rejected
do $$ begin
  begin
    perform public.join_workspace(current_setting('t.code'));
    raise exception 'FAIL[31]: 11th member accepted';
  exception when others then if sqlerrm <> 'member_limit' then raise; end if;
  end;
end $$;

-- ===== Non-member (C) cannot read or write anything in WS One =====
:as_c
-- [32..38] selects return nothing
do $$ declare ws uuid := current_setting('t.ws1')::uuid; begin
  if exists (select 1 from public.workspaces where id = ws) then raise exception 'FAIL[32]: outsider sees workspace'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = ws) then raise exception 'FAIL[33]: outsider sees members'; end if;
  if exists (select 1 from public.bugs where workspace_id = ws) then raise exception 'FAIL[34]: outsider sees bugs'; end if;
  if exists (select 1 from public.comments) then raise exception 'FAIL[35]: outsider sees comments'; end if;
  if exists (select 1 from public.bug_events) then raise exception 'FAIL[36]: outsider sees bug_events'; end if;
  if exists (select 1 from public.bug_attachments) then raise exception 'FAIL[37]: outsider sees attachments'; end if;
  if exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001') then raise exception 'FAIL[38]: outsider sees owner profile'; end if;
  if not exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000003') then raise exception 'FAIL[38]: user cannot see own profile'; end if;
end $$;
-- [39] insert bug rejected
do $$ begin
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by)
      values (current_setting('t.ws1')::uuid, 'Intruder', 'x', 'low', '10000000-0000-0000-0000-000000000003');
    raise exception 'FAIL[39]: outsider inserted bug';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
end $$;
-- [40] update/delete bug / [41] update workspace / [42] update members affect 0 rows
do $$ declare n int; begin
  begin update public.bugs set title = 'pwn' where id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[40]: outsider updated bug'; end if;
  begin delete from public.bugs where id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[40]: outsider deleted bug'; end if;
  begin update public.workspaces set name = 'pwn' where id = current_setting('t.ws1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[41]: outsider updated workspace'; end if;
  begin update public.workspace_members set role = 'owner' where workspace_id = current_setting('t.ws1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[42]: outsider updated members'; end if;
end $$;
-- [43] comment / [44] attachment / [45] direct workspace insert / [46] self-add as member rejected
do $$ declare ws uuid := current_setting('t.ws1')::uuid; b uuid := current_setting('t.bug1')::uuid; begin
  begin
    insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000003', 'x');
    raise exception 'FAIL[43]: outsider inserted comment';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin
    insert into public.bug_attachments (bug_id, storage_path, width, height, size_bytes) values (b, ws || '/' || b || '/z.webp', 1, 1, 1);
    raise exception 'FAIL[44]: outsider inserted attachment';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin
    insert into public.workspaces (name, owner_id) values ('Direct', '10000000-0000-0000-0000-000000000003');
    raise exception 'FAIL[45]: direct workspace insert accepted';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, '10000000-0000-0000-0000-000000000003', 'member');
    raise exception 'FAIL[46]: outsider self-added as member';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
end $$;
-- [47] outsider cannot read workspace_stats (error not_member or empty result both acceptable)
do $$ declare n int := 0; begin
  begin
    select count(*) into n from public.workspace_stats(current_setting('t.ws1')::uuid);
  exception when others then
    if sqlerrm <> 'not_member' then raise; end if;
    n := 0;
  end;
  if n <> 0 then raise exception 'FAIL[47]: outsider got workspace_stats rows'; end if;
end $$;
-- [48] storage: outsider cannot see objects under screenshots/<ws>/ ; [49] cannot upload there
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id = 'screenshots' and name like current_setting('t.ws1') || '/%';
  if n <> 0 then raise exception 'FAIL[48]: outsider sees % storage objects', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('screenshots', current_setting('t.ws1') || '/evil/x.webp');
    raise exception 'FAIL[49]: outsider uploaded to workspace folder';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
end $$;
:as_b
-- [50] member can see the storage object
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'screenshots' and name like current_setting('t.ws1') || '/%') < 1 then
    raise exception 'FAIL[50]: member cannot see storage object'; end if;
end $$;

-- ===== workspace_limit: 5 owned max (user W) =====
:as_w
do $$ declare i int; begin
  for i in 1..5 loop perform public.create_workspace('W' || i); end loop;
  begin
    perform public.create_workspace('W6');
    raise exception 'FAIL[51]: 6th owned workspace accepted';
  exception when others then if sqlerrm <> 'workspace_limit' then raise; end if; end;
end $$;

-- ===== rate_limited: 30 bugs per minute (user R) =====
:as_r
do $$ declare w public.workspaces; i int; begin
  w := public.create_workspace('Rate WS');
  for i in 1..30 loop
    insert into public.bugs (workspace_id, title, description, severity, filed_by)
      values (w.id, 'bug ' || i, 'x', 'low', '10000000-0000-0000-0000-000000000014');
  end loop;
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by)
      values (w.id, 'bug 31', 'x', 'low', '10000000-0000-0000-0000-000000000014');
    raise exception 'FAIL[52]: 31st bug in a minute accepted';
  exception when others then if sqlerrm <> 'rate_limited' then raise; end if; end;
end $$;

-- ===== Assignees (0004_assignees.sql); WS One members: A, B, 04..11; C is an outsider =====
:as_a
-- [55] member assigns another member: 'assigned' event (actor A, note = assignee), no 'edited' event
do $$ declare b uuid := current_setting('t.bug1')::uuid; n_edited int; begin
  select count(*) into n_edited from public.bug_events where bug_id = b and type = 'edited';
  update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000002' where id = b;
  if (select assignee_id from public.bugs where id = b) is distinct from '10000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL[55]: member could not assign another member'; end if;
  if not exists (select 1 from public.bug_events where bug_id = b and type = 'assigned'
                 and actor_id = '10000000-0000-0000-0000-000000000001' and note = '10000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL[55]: assigned event missing or wrong actor/note'; end if;
  if (select count(*) from public.bug_events where bug_id = b and type = 'edited') <> n_edited then
    raise exception 'FAIL[55]: assigning logged an edited event'; end if;
end $$;
-- [56] non-member assignee rejected on update and on insert; assignment unchanged
do $$ declare b uuid := current_setting('t.bug1')::uuid; begin
  begin
    update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000003' where id = b;
    raise exception 'FAIL[56]: non-member assignee accepted on update';
  exception when others then if sqlerrm <> 'assignee_not_member' then raise; end if;
  end;
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by, assignee_id)
      values (current_setting('t.ws1')::uuid, 'Bad assignee', 'x', 'low', '10000000-0000-0000-0000-000000000001',
              '10000000-0000-0000-0000-000000000003');
    raise exception 'FAIL[56]: non-member assignee accepted on insert';
  exception when others then if sqlerrm <> 'assignee_not_member' then raise; end if;
  end;
  if (select assignee_id from public.bugs where id = b) is distinct from '10000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL[56]: rejected assignment changed assignee_id'; end if;
end $$;
:as_c
-- [57] outsider cannot change the assignee (row invisible); [58] outsider cannot probe membership via insert
do $$ declare n int; begin
  begin update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000003' where id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[57]: outsider updated assignee'; end if;
  begin
    insert into public.bugs (workspace_id, title, description, severity, filed_by, assignee_id)
      values (current_setting('t.ws1')::uuid, 'Probe', 'x', 'low', '10000000-0000-0000-0000-000000000003',
              '10000000-0000-0000-0000-000000000002');
    raise exception 'FAIL[58]: outsider inserted bug with assignee';
  exception when others then if sqlerrm <> 'assignee_not_member' then raise; end if;
  end;
end $$;
:as_pg
do $$ begin
  if (select assignee_id from public.bugs where id = current_setting('t.bug1')::uuid) is distinct from '10000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL[57]: outsider changed assignee_id'; end if;
end $$;
:as_a
-- [59] removing a member clears their assignments (with an 'assigned' event, null note); they cannot be re-assigned
do $$ declare b uuid := current_setting('t.bug1')::uuid; begin
  update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000004' where id = b;
  perform public.remove_member(current_setting('t.ws1')::uuid, '10000000-0000-0000-0000-000000000004');
  if (select assignee_id from public.bugs where id = b) is not null then
    raise exception 'FAIL[59]: removed member still assigned'; end if;
  if not exists (select 1 from public.bug_events where bug_id = b and type = 'assigned'
                 and actor_id = '10000000-0000-0000-0000-000000000001' and note is null) then
    raise exception 'FAIL[59]: unassign on member removal not logged'; end if;
  begin
    update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000004' where id = b;
    raise exception 'FAIL[59]: removed member could be assigned';
  exception when others then if sqlerrm <> 'assignee_not_member' then raise; end if;
  end;
  -- [60] explicit unassign works
  update public.bugs set assignee_id = '10000000-0000-0000-0000-000000000002' where id = b;
  update public.bugs set assignee_id = null where id = b;
  if (select assignee_id from public.bugs where id = b) is not null then
    raise exception 'FAIL[60]: unassign failed'; end if;
end $$;

:as_pg
\o
\echo ALL RLS TESTS PASSED
rollback;
