/**
 * Hand-written Supabase schema types. Must stay in sync with supabase/migrations/0001_init.sql.
 * Shape follows `supabase gen types typescript` output so `createClient<Database>` is fully typed.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type MemberRoleEnum = 'owner' | 'member'
type BugSeverityEnum = 'low' | 'medium' | 'high' | 'critical'
type BugStatusEnum = 'open' | 'resolved'
type BugKindEnum = 'bug' | 'feature'
/** fix_runs.status is text with a CHECK (0008_fix_runs.sql), not a Postgres enum. */
type FixRunStatusEnum = 'running' | 'succeeded' | 'failed' | 'cancelled'
type BugEventTypeEnum = 'filed' | 'resolved' | 'reopened' | 'edited' | 'commented' | 'assigned'

type WorkspaceRow = {
  id: string
  name: string
  invite_code: string
  owner_id: string
  created_at: string
  next_bug_number: number
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          avatar_color: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string
          avatar_url?: string | null
          avatar_color?: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_url?: string | null
          avatar_color?: string
          created_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: WorkspaceRow
        Insert: {
          id?: string
          name: string
          invite_code?: string
          owner_id: string
          created_at?: string
          next_bug_number?: number
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          owner_id?: string
          created_at?: string
          next_bug_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'workspaces_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: MemberRoleEnum
          joined_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: MemberRoleEnum
          joined_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: MemberRoleEnum
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bugs: {
        Row: {
          id: string
          workspace_id: string
          number: number
          title: string
          description: string
          context: Json | null
          transcript: string | null
          severity: BugSeverityEnum
          status: BugStatusEnum
          kind: BugKindEnum
          filed_by: string
          created_at: string
          resolved_by: string | null
          resolved_at: string | null
          resolution_note: string | null
          updated_at: string
          assignee_id: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          /** Assigned by the `bugs_set_number` trigger. */
          number?: number
          title: string
          description: string
          context?: Json | null
          transcript?: string | null
          severity?: BugSeverityEnum
          status?: BugStatusEnum
          kind?: BugKindEnum
          filed_by: string
          created_at?: string
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          updated_at?: string
          assignee_id?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          number?: number
          title?: string
          description?: string
          context?: Json | null
          transcript?: string | null
          severity?: BugSeverityEnum
          status?: BugStatusEnum
          kind?: BugKindEnum
          filed_by?: string
          created_at?: string
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          updated_at?: string
          assignee_id?: string | null
        }
        /** filed_by / resolved_by / assignee_id have no FK: attribution survives account deletion. */
        Relationships: [
          {
            foreignKeyName: 'bugs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      bug_attachments: {
        Row: {
          id: string
          bug_id: string
          storage_path: string
          width: number
          height: number
          size_bytes: number
          created_at: string
        }
        Insert: {
          id?: string
          bug_id: string
          storage_path: string
          width: number
          height: number
          size_bytes: number
          created_at?: string
        }
        Update: {
          id?: string
          bug_id?: string
          storage_path?: string
          width?: number
          height?: number
          size_bytes?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bug_attachments_bug_id_fkey'
            columns: ['bug_id']
            isOneToOne: false
            referencedRelation: 'bugs'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          id: string
          bug_id: string
          author_id: string
          body: string
          created_at: string
          /** Set by the server whenever `body` changes; null if never edited. */
          edited_at: string | null
        }
        Insert: {
          id?: string
          bug_id: string
          author_id: string
          body: string
          created_at?: string
        }
        /** Clients may only change `body` (column grant + comments_guard trigger). */
        Update: {
          body?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_bug_id_fkey'
            columns: ['bug_id']
            isOneToOne: false
            referencedRelation: 'bugs'
            referencedColumns: ['id']
          },
        ]
      }
      bug_events: {
        Row: {
          id: string
          bug_id: string
          actor_id: string
          type: BugEventTypeEnum
          note: string | null
          created_at: string
          /** 'commented' events only: the comment (its note is redacted on edit/delete). */
          comment_id: string | null
        }
        /** Inserted only by triggers; no client INSERT policy exists. */
        Insert: {
          id?: string
          bug_id: string
          actor_id: string
          type: BugEventTypeEnum
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bug_id?: string
          actor_id?: string
          type?: BugEventTypeEnum
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bug_events_bug_id_fkey'
            columns: ['bug_id']
            isOneToOne: false
            referencedRelation: 'bugs'
            referencedColumns: ['id']
          },
        ]
      }
      /**
       * Record of deleted bugs (0005_hardening.sql). Members of the workspace can read it; written only
       * by the bugs_log_deletion trigger (no client INSERT/UPDATE/DELETE grants).
       */
      bug_deletions: {
        Row: {
          id: string
          workspace_id: string
          bug_number: number
          title: string
          kind: BugKindEnum
          /** null when deleted without a signed-in user (service role / dashboard). */
          deleted_by: string | null
          deleted_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          bug_number: number
          title: string
          kind: BugKindEnum
          deleted_by?: string | null
          deleted_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          bug_number?: number
          title?: string
          kind?: BugKindEnum
          deleted_by?: string | null
          deleted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bug_deletions_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      /** Rate-limit log written only by the bugs_rate_limit trigger; no client access (RLS, no grants). */
      bug_filings: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      /**
       * Proof of fix (0008_fix_runs.sql): one Claude Code run on one bug and the git evidence the
       * local helper reported. Members read; a member inserts as themselves; only the creator updates,
       * and only while the run is 'running'. workspace_id, started_at and finished_at are set by the
       * server. No client deletes.
       */
      fix_runs: {
        Row: {
          id: string
          bug_id: string
          workspace_id: string
          run_id: string
          status: FixRunStatusEnum
          branch: string | null
          commit_sha: string | null
          pr_url: string | null
          files_changed: number | null
          additions: number | null
          deletions: number | null
          summary: string | null
          after_attachment_id: string | null
          created_by: string
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          bug_id: string
          /** Ignored: the server derives it from the bug. */
          workspace_id?: string
          run_id: string
          status?: FixRunStatusEnum
          branch?: string | null
          commit_sha?: string | null
          pr_url?: string | null
          files_changed?: number | null
          additions?: number | null
          deletions?: number | null
          summary?: string | null
          after_attachment_id?: string | null
          created_by?: string
          /** Clamped by the server to the last 24 hours. */
          started_at?: string
        }
        Update: {
          status?: FixRunStatusEnum
          branch?: string | null
          commit_sha?: string | null
          pr_url?: string | null
          files_changed?: number | null
          additions?: number | null
          deletions?: number | null
          summary?: string | null
          after_attachment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fix_runs_bug_id_fkey'
            columns: ['bug_id']
            isOneToOne: false
            referencedRelation: 'bugs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fix_runs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fix_runs_after_attachment_id_fkey'
            columns: ['after_attachment_id']
            isOneToOne: false
            referencedRelation: 'bug_attachments'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      create_workspace: {
        Args: { p_name: string }
        Returns: WorkspaceRow
      }
      join_workspace: {
        Args: { p_code: string }
        Returns: WorkspaceRow
      }
      workspace_preview: {
        Args: { p_code: string }
        Returns: { id: string; name: string; member_count: number }[]
      }
      regenerate_invite_code: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      remove_member: {
        Args: { p_workspace_id: string; p_user_id: string }
        Returns: undefined
      }
      transfer_ownership: {
        Args: { p_workspace_id: string; p_new_owner: string }
        Returns: undefined
      }
      delete_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      delete_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      workspace_stats: {
        Args: { p_workspace_id: string }
        Returns: {
          user_id: string
          filed_total: number
          resolved_total: number
          filed_7d: number
          resolved_7d: number
        }[]
      }
    }
    Enums: {
      member_role: MemberRoleEnum
      bug_severity: BugSeverityEnum
      bug_status: BugStatusEnum
      bug_kind: BugKindEnum
      bug_event_type: BugEventTypeEnum
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
export type Functions<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]
