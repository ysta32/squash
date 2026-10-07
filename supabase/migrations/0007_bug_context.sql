alter table public.bugs add column if not exists context jsonb;

alter table public.bugs drop constraint if exists bugs_context_check;
alter table public.bugs add constraint bugs_context_check check (
  context is null or (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 16384)
);

-- Existing bugs_insert requires membership and filed_by = auth.uid(); bugs_update
-- requires membership. bugs_guard preserves immutable attribution, while context
-- remains editable like description. No policies or grants need changing.
