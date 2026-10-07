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

-- ===== Hardening (0005_hardening.sql): delete = filer or owner; deletion log; comment rate limit =====
:as_pg
-- [61] re-running 0001..0005 in order ends with exactly one, restrictive, bugs DELETE policy
do $$ begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'bugs' and cmd = 'DELETE') <> 1 then
    raise exception 'FAIL[61]: expected exactly one DELETE policy on bugs'; end if;
  if (select qual from pg_policies where schemaname = 'public' and tablename = 'bugs' and policyname = 'bugs_delete')
     not like '%is_workspace_owner%' then
    raise exception 'FAIL[61]: bugs_delete is not the filer-or-owner policy from 0005'; end if;
end $$;
:as_b
-- [62] a member who did not file the bug (B; bug1 is A's) cannot delete it
do $$ declare n int; begin
  delete from public.bugs where id = current_setting('t.bug1')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[62]: non-filer member deleted a bug'; end if;
end $$;
:as_pg
do $$ begin
  if not exists (select 1 from public.bugs where id = current_setting('t.bug1')::uuid) then
    raise exception 'FAIL[62]: bug1 gone after refused delete'; end if;
end $$;
:as_b
-- [63] the filer can delete their own bug; the deletion is logged with deleted_by and visible to members
do $$ declare b uuid; num int; n int; begin
  insert into public.bugs (workspace_id, title, description, severity, filed_by, kind)
    values (current_setting('t.ws1')::uuid, 'Filer deletes', 'x', 'low', '10000000-0000-0000-0000-000000000002', 'feature')
    returning id, number into b, num;
  perform set_config('t.del_filer_num', num::text, true);
  delete from public.bugs where id = b; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[63]: filer could not delete own bug'; end if;
  if not exists (select 1 from public.bug_deletions
                 where workspace_id = current_setting('t.ws1')::uuid and bug_number = num
                   and title = 'Filer deletes' and kind = 'feature'
                   and deleted_by = '10000000-0000-0000-0000-000000000002' and deleted_at is not null) then
    raise exception 'FAIL[63]: deletion not logged (or not visible to the member) with deleted_by'; end if;
  -- the refused delete in [62] logged nothing
  if exists (select 1 from public.bug_deletions d join public.bugs x on x.number = d.bug_number and x.workspace_id = d.workspace_id
             where x.id = current_setting('t.bug1')::uuid) then
    raise exception 'FAIL[63]: refused delete was logged'; end if;
  insert into public.bugs (workspace_id, title, description, severity, filed_by)
    values (current_setting('t.ws1')::uuid, 'Owner deletes', 'x', 'low', '10000000-0000-0000-0000-000000000002')
    returning id into b;
  perform set_config('t.bug_owner_target', b::text, true);
end $$;
:as_a
-- [64] the workspace owner can delete a bug filed by someone else
do $$ declare n int; num int; begin
  select number into num from public.bugs where id = current_setting('t.bug_owner_target')::uuid;
  delete from public.bugs where id = current_setting('t.bug_owner_target')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[64]: owner could not delete a member''s bug'; end if;
  if not exists (select 1 from public.bug_deletions
                 where workspace_id = current_setting('t.ws1')::uuid and bug_number = num
                   and deleted_by = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL[64]: owner deletion not logged with deleted_by = owner'; end if;
end $$;
:as_c
-- [65] outsiders see no deletion log rows and cannot delete through the new policy
do $$ begin
  if exists (select 1 from public.bug_deletions) then
    raise exception 'FAIL[65]: outsider sees bug_deletions'; end if;
end $$;
:as_anon
do $$ declare n int; begin
  begin select count(*) into n from public.bug_deletions;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[65]: anon sees bug_deletions'; end if;
end $$;
:as_b
-- [66] members cannot insert, update or delete deletion log rows
do $$ declare n int; begin
  begin
    insert into public.bug_deletions (workspace_id, bug_number, title, kind, deleted_by)
      values (current_setting('t.ws1')::uuid, 999, 'forged', 'bug', '10000000-0000-0000-0000-000000000001');
    raise exception 'FAIL[66]: member inserted bug_deletions';
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;
  begin update public.bug_deletions set title = 'tamper'; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[66]: member updated bug_deletions'; end if;
  begin delete from public.bug_deletions; get diagnostics n = row_count;
  exception when sqlstate '42501' then n := 0; end;
  if n <> 0 then raise exception 'FAIL[66]: member deleted bug_deletions'; end if;
end $$;
:as_pg
do $$ begin
  if not exists (select 1 from public.bug_deletions
                 where workspace_id = current_setting('t.ws1')::uuid
                   and bug_number = current_setting('t.del_filer_num')::int and title = 'Filer deletes') then
    raise exception 'FAIL[66]: deletion log row was changed or removed by a member'; end if;
  -- defense in depth: no write grants at all (RLS alone does not cover TRUNCATE)
  if has_table_privilege('authenticated', 'public.bug_deletions', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('anon', 'public.bug_deletions', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL[66]: bug_deletions has client write grants (or anon access)'; end if;
end $$;
:as_r
-- [67] comments: 30 per author per minute, the 31st is rejected; created_at is server-owned
do $$ declare b uuid; i int; ts timestamptz; begin
  select id into b from public.bugs where filed_by = '10000000-0000-0000-0000-000000000014' order by number limit 1;
  insert into public.comments (bug_id, author_id, body, created_at)
    values (b, '10000000-0000-0000-0000-000000000014', 'backdated', '2000-01-01')
    returning created_at into ts;
  if ts <> now() then raise exception 'FAIL[67]: client-supplied comments.created_at was kept'; end if;
  for i in 2..30 loop
    insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000014', 'c' || i);
  end loop;
  begin
    insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000014', 'c31');
    raise exception 'FAIL[67]: 31st comment in a minute accepted';
  exception when others then if sqlerrm <> 'rate_limited' then raise; end if; end;
end $$;
-- [69] an outsider spoofing a rate-limited user's author_id gets the RLS denial, never rate_limited
:as_c
do $$ declare b uuid; begin
  select id into b from public.bugs where filed_by = '10000000-0000-0000-0000-000000000014' order by number limit 1;
  begin
    insert into public.comments (bug_id, author_id, body) values (b, '10000000-0000-0000-0000-000000000014', 'probe');
    raise exception 'FAIL[69]: outsider inserted a comment as another user';
  exception when others then if sqlstate <> '42501' then
    raise exception 'FAIL[69]: outsider spoofing author_id got % (%), expected RLS denial', sqlerrm, sqlstate; end if;
  end;
end $$;
-- [70] a member of another workspace spoofing the rate-limited user's author_id on their own bug also
-- gets the RLS denial
:as_b
do $$ begin
  begin
    insert into public.comments (bug_id, author_id, body)
      values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000014', 'probe');
    raise exception 'FAIL[70]: member inserted a comment as another user';
  exception when others then if sqlstate <> '42501' then
    raise exception 'FAIL[70]: spoofed author_id got % (%), expected RLS denial', sqlerrm, sqlstate; end if;
  end;
end $$;
:as_r
-- [68] deleting a workspace that has bugs and deletion log rows still works and removes its log
do $$ declare w uuid; b uuid; begin
  select workspace_id, id into w, b from public.bugs where filed_by = '10000000-0000-0000-0000-000000000014' order by number limit 1;
  delete from public.bugs where id = b;
  if not exists (select 1 from public.bug_deletions where workspace_id = w) then
    raise exception 'FAIL[68]: deletion in Rate WS not logged'; end if;
  perform public.delete_workspace(w);
  perform set_config('t.rate_ws', w::text, true);
end $$;
:as_pg
do $$ begin
  if exists (select 1 from public.bug_deletions where workspace_id = current_setting('t.rate_ws')::uuid) then
    raise exception 'FAIL[68]: deletion log survived its workspace'; end if;
  if exists (select 1 from public.bugs where workspace_id = current_setting('t.rate_ws')::uuid) then
    raise exception 'FAIL[68]: bugs survived their workspace'; end if;
end $$;

-- ===== Comment edit / delete (0006_comment_edit.sql) =====
:as_b
-- [71] author edits the body of their own comment: edited_at set, nothing else changes
do $$ declare c public.comments; n int; begin
  insert into public.comments (bug_id, author_id, body, edited_at)
    values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000002', 'original', now()) returning * into c;
  perform set_config('t.cm_b', c.id::text, true);
  if c.edited_at is not null then raise exception 'FAIL[71]: new comment kept a client-sent edited_at'; end if;
  update public.comments set body = 'edited text' where id = c.id; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[71]: author could not edit own comment'; end if;
  if not exists (select 1 from public.comments where id = c.id and body = 'edited text' and edited_at is not null
                 and bug_id = c.bug_id and author_id = c.author_id and created_at = c.created_at) then
    raise exception 'FAIL[71]: edit did not set edited_at or changed other columns'; end if;
end $$;
-- [72] author cannot change bug_id / author_id / created_at / edited_at (column privilege)
do $$ declare b2 uuid; begin
  begin
    update public.comments set author_id = '10000000-0000-0000-0000-000000000001' where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[72]: author_id changed';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  select id into b2 from public.bugs where workspace_id = current_setting('t.ws1')::uuid and id <> current_setting('t.bug1')::uuid limit 1;
  begin
    update public.comments set bug_id = coalesce(b2, gen_random_uuid()) where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[72]: bug_id changed';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin
    update public.comments set created_at = now() - interval '1 day' where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[72]: created_at changed';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin
    update public.comments set edited_at = null where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[72]: edited_at written by client';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
end $$;
:as_a
-- [73] other members (incl. the owner) cannot edit; a plain member cannot delete someone else's comment
do $$ declare n int; begin
  update public.comments set body = 'owner edit' where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[73]: owner edited another member''s comment'; end if;
  perform set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
  update public.comments set body = 'member edit' where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[73]: member edited another member''s comment'; end if;
  delete from public.comments where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[73]: member deleted another member''s comment'; end if;
end $$;
:as_c
-- [74] outsider cannot edit or delete (same 0-row result as for a missing comment)
do $$ declare n int; begin
  update public.comments set body = 'outsider' where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[74]: outsider edited a comment'; end if;
  delete from public.comments where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[74]: outsider deleted a comment'; end if;
end $$;
:as_pg
-- [75] the guard holds for the service role too; a body-less update keeps edited_at
do $$ declare e timestamptz; begin
  begin
    update public.comments set author_id = '10000000-0000-0000-0000-000000000001' where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[75]: service role changed author_id';
  exception when others then if sqlerrm <> 'immutable_field' then raise; end if; end;
  begin
    update public.comments set created_at = now() - interval '1 day' where id = current_setting('t.cm_b')::uuid;
    raise exception 'FAIL[75]: service role changed created_at';
  exception when others then if sqlerrm <> 'immutable_field' then raise; end if; end;
  select edited_at into e from public.comments where id = current_setting('t.cm_b')::uuid;
  update public.comments set body = body, edited_at = null where id = current_setting('t.cm_b')::uuid;
  if (select edited_at from public.comments where id = current_setting('t.cm_b')::uuid) is distinct from e then
    raise exception 'FAIL[75]: edited_at not kept on a no-op update'; end if;
  -- a comment by member 04, who was removed from WS One in [59]
  insert into public.comments (bug_id, author_id, body)
    values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000004', 'left behind');
end $$;
:as_a
-- [76] a removed member can no longer edit or delete their old comment
do $$ declare n int; id4 uuid; begin
  select id into id4 from public.comments where author_id = '10000000-0000-0000-0000-000000000004' and body = 'left behind';
  perform set_config('t.cm_4', id4::text, true);
  perform set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
  update public.comments set body = 'still mine' where id = id4; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[76]: removed member edited their comment'; end if;
  delete from public.comments where id = id4; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL[76]: removed member deleted their comment'; end if;
end $$;
:as_a
-- [77] the workspace owner can delete any comment in the workspace
do $$ declare n int; begin
  delete from public.comments where id = current_setting('t.cm_4')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[77]: owner could not delete a comment'; end if;
end $$;
:as_b
-- [78] the author can delete their own comment
do $$ declare n int; begin
  delete from public.comments where id = current_setting('t.cm_b')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL[78]: author could not delete own comment'; end if;
end $$;
:as_pg
do $$ begin
  if exists (select 1 from public.comments where id in (current_setting('t.cm_b')::uuid, current_setting('t.cm_4')::uuid)) then
    raise exception 'FAIL[78]: deleted comments still present'; end if;
end $$;

-- ===== Comment text in the activity log is redacted on edit / delete (0006) =====
:as_b
-- [79] a new comment's event is linked to it; editing replaces the event text
do $$ declare cid uuid; begin
  insert into public.comments (bug_id, author_id, body)
    values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000002', 'secret one') returning id into cid;
  perform set_config('t.cm_r', cid::text, true);
  perform set_config('t.ev_r', (select id::text from public.bug_events where comment_id = cid), true);
  if not exists (select 1 from public.bug_events where comment_id = cid and type = 'commented' and note = 'secret one') then
    raise exception 'FAIL[79]: commented event not linked to its comment'; end if;
  update public.comments set body = 'public v2' where id = cid;
end $$;
:as_a
do $$ begin
  if exists (select 1 from public.bug_events where note = 'secret one') then
    raise exception 'FAIL[79]: original text still readable after edit'; end if;
  if not exists (select 1 from public.bug_events where comment_id = current_setting('t.cm_r')::uuid and note = 'public v2') then
    raise exception 'FAIL[79]: event text not updated to the edited body'; end if;
end $$;
:as_b
delete from public.comments where id = current_setting('t.cm_r')::uuid;
:as_a
-- [80] deleting the comment clears the event text (the event itself stays)
do $$ begin
  if exists (select 1 from public.bug_events where note in ('secret one', 'public v2')) then
    raise exception 'FAIL[80]: deleted comment text still readable'; end if;
  if not exists (select 1 from public.bug_events where id = current_setting('t.ev_r')::uuid and note is null and comment_id is null) then
    raise exception 'FAIL[80]: commented event missing, not redacted or still linked'; end if;
end $$;
-- [81] legacy events (no comment_id) are redacted by author + identical text, on edit and on delete
:as_b
do $$ declare cid uuid; begin
  insert into public.comments (bug_id, author_id, body)
    values (current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000002', 'legacy secret') returning id into cid;
  perform set_config('t.cm_l', cid::text, true);
end $$;
:as_pg
update public.bug_events set comment_id = null where comment_id = current_setting('t.cm_l')::uuid;
:as_b
update public.comments set body = 'legacy v2' where id = current_setting('t.cm_l')::uuid;
:as_a
do $$ begin
  if exists (select 1 from public.bug_events where note = 'legacy secret') then
    raise exception 'FAIL[81]: legacy event kept the original text after edit'; end if;
end $$;
:as_b
delete from public.comments where id = current_setting('t.cm_l')::uuid;
:as_a
do $$ begin
  if exists (select 1 from public.bug_events where note in ('legacy secret', 'legacy v2')) then
    raise exception 'FAIL[81]: legacy event kept the text after delete'; end if;
end $$;
:as_pg
-- [82] comments replica identity is DEFAULT; redaction / event functions are not client-callable
do $$ begin
  if (select relreplident from pg_class where oid = 'public.comments'::regclass) <> 'd' then
    raise exception 'FAIL[82]: comments replica identity is not default'; end if;
  if has_function_privilege('authenticated', 'public.comments_redact_events()', 'execute')
     or has_function_privilege('anon', 'public.comments_redact_events()', 'execute')
     or has_function_privilege('authenticated', 'public.comments_guard()', 'execute') then
    raise exception 'FAIL[82]: comment trigger functions callable by clients'; end if;
end $$;

:as_a
-- [83] reusing a deleted comment's id can't rewrite the original author's retained event
insert into public.comments (id, bug_id, author_id, body)
  values (current_setting('t.cm_r')::uuid, current_setting('t.bug1')::uuid, '10000000-0000-0000-0000-000000000001', 'reuse v1');
update public.comments set body = 'reuse v2' where id = current_setting('t.cm_r')::uuid;
delete from public.comments where id = current_setting('t.cm_r')::uuid;
do $$ begin
  if not exists (select 1 from public.bug_events where id = current_setting('t.ev_r')::uuid and note is null) then
    raise exception 'FAIL[83]: id reuse rewrote another member''s event'; end if;
end $$;
:as_pg
-- [84] bug_events replica identity is DEFAULT, so redacted notes don't persist in old-row images
do $$ begin
  if (select relreplident from pg_class where oid = 'public.bug_events'::regclass) <> 'd' then
    raise exception 'FAIL[84]: bug_events replica identity is not default'; end if;
end $$;

:as_pg
\o
\echo ALL RLS TESTS PASSED
rollback;
