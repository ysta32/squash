/**
 * Hand-written Supabase schema types. Must stay in sync with supabase/migrations/0001_init.sql.
 * Shape follows `supabase gen types typescript` output so `createClient<Database>` is fully typed.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type MemberRoleEnum = 'owner' | 'member'
type BugSeverityEnum = 'low' | 'medium' | 'high' | 'critical'
type BugStatusEnum = 'open' | 'resolved'
type BugKindEnum = 'bug' | 'feature'
type BugEventTypeEnum = 'filed' | 'resolved' | 'reopened' | 'edited' | 'commented'

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
        }
        Insert: {
          id?: string
          workspace_id: string
          /** Assigned by the `bugs_set_number` trigger. */
          number?: number
          title: string
          description: string
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
        }
        Update: {
          id?: string
          workspace_id?: string
          number?: number
          title?: string
          description?: string
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
        }
        /** filed_by / resolved_by have no FK: attribution survives account deletion. */
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
        }
        Insert: {
          id?: string
          bug_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          bug_id?: string
          author_id?: string
          body?: string
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_member: {
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
