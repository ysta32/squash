-- =============================================================================
-- Squash — tests
--
-- Adds 'test' to bug_kind so a workspace can track tests (checks to write or
-- run) under their own Tests tab, next to Bugs and Features. Tests share the
-- bugs table, numbering, attachments, comments and activity log like features
-- do (see 0002_bug_kind.sql). Re-runnable: add value is guarded.
-- =============================================================================

alter type public.bug_kind add value if not exists 'test';
