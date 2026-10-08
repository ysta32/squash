-- Live markup layers: screenshots keep their original pixels and carry vector annotations
-- (arrow, box, pen, numbered pin) as versioned JSON: {"v": 1, "shapes": [...]}.
-- Re-runnable: every statement is guarded or replaces what it creates.

alter table public.bug_attachments add column if not exists annotations jsonb;
-- Who uploaded the attachment. Only they may edit its annotations. No FK, like assignee_id:
-- attribution survives account deletion as a dangling id.
alter table public.bug_attachments add column if not exists uploaded_by uuid;

-- Shape: an object with v = 1 and a shapes array of at most 50 entries, at most 32 KB as text.
-- The size is measured on the jsonb text form so the client can compute the same number.
-- CASE keeps jsonb_array_length from erroring on non-arrays (AND does not short-circuit in order);
-- coalesce turns missing keys into a violation instead of a passing NULL.
alter table public.bug_attachments drop constraint if exists bug_attachments_annotations_check;
alter table public.bug_attachments add constraint bug_attachments_annotations_check check (
  annotations is null or (
    case
      when jsonb_typeof(annotations) <> 'object' then false
      when coalesce(jsonb_typeof(annotations -> 'shapes'), '') <> 'array' then false
      else coalesce(annotations -> 'v' = '1'::jsonb, false)
        and jsonb_array_length(annotations -> 'shapes') <= 50
        and octet_length(annotations::text) <= 32768
    end
  )
);

-- The uploader is always the inserting user (clients cannot attribute uploads to someone else).
create or replace function public.bug_attachments_set_uploader()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.uploaded_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists bug_attachments_set_uploader on public.bug_attachments;
create trigger bug_attachments_set_uploader
  before insert on public.bug_attachments
  for each row execute function public.bug_attachments_set_uploader();

-- Existing rows: the uploader is the owner of the storage object (set by Supabase Storage).
update public.bug_attachments a
set uploaded_by = o.owner
from storage.objects o
where a.uploaded_by is null
  and o.bucket_id = 'screenshots'
  and o.name = a.storage_path
  and o.owner is not null;

-- Updates: only the annotations column, only by the uploader while still a workspace member.
-- (Select, insert and delete keep their 0001 policies and grants.)
revoke update on table public.bug_attachments from anon, authenticated;
grant update (annotations) on table public.bug_attachments to authenticated;

drop policy if exists bug_attachments_update on public.bug_attachments;
create policy bug_attachments_update on public.bug_attachments
  for update to authenticated
  using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.bugs b
      where b.id = bug_attachments.bug_id and public.is_member(b.workspace_id)
    )
  )
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.bugs b
      where b.id = bug_attachments.bug_id and public.is_member(b.workspace_id)
    )
  );
