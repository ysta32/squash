-- =============================================================================
-- Squash — to-dos
--
-- Adds 'todo' to bug_kind so a workspace can keep a to-do list of things that
-- need doing for the project, under its own To-dos tab next to Bugs, Features
-- and Tests. To-dos share the bugs table, numbering, attachments, comments and
-- activity log like the other kinds (see 0002_bug_kind.sql, 0010_test_kind.sql).
-- Re-runnable: add value is guarded.
-- =============================================================================

alter type public.bug_kind add value if not exists 'todo';
