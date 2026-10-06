-- =============================================================================
-- Squash — deleting bugs
--
-- Members can delete a bug (or feature request) outright, as an alternative to
-- resolving it. Its attachments, comments and activity cascade. Numbers are not
-- reused: bugs_set_number counts from workspaces.next_bug_number. Storage files
-- are removed by the client through the Storage API (screenshots_delete policy).
-- Re-runnable like 0001_init.sql.
-- =============================================================================

drop policy if exists bugs_delete on public.bugs;
create policy bugs_delete on public.bugs
  for delete to authenticated
  using (public.is_member(workspace_id));

grant delete on table public.bugs to authenticated;
