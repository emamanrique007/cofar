export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          id: number
        }
        Insert: {
          account_id: string
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          id?: never
        }
        Update: {
          account_id?: string
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          account_id: string
          attempts: number
          body: string
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          last_error: string | null
          request_id: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          account_id: string
          attempts?: number
          body: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_error?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          account_id?: string
          attempts?: number
          body?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_error?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string
          body: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          account_id: string
          body: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          account_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          account_id: string
          first_response_minutes: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
        }
        Insert: {
          account_id: string
          first_response_minutes: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
        }
        Update: {
          account_id?: string
          first_response_minutes?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_agents: {
        Row: {
          account_id: string
          auto_assign: boolean
          availability: Database["public"]["Enums"]["ticket_availability"]
          category_ids: string[]
          created_at: string
          last_assigned_at: string | null
          max_open_tickets: number
          timezone: string
          user_id: string
          workday_end: string
          workday_start: string
          working_days: number[]
        }
        Insert: {
          account_id: string
          auto_assign?: boolean
          availability?: Database["public"]["Enums"]["ticket_availability"]
          category_ids?: string[]
          created_at?: string
          last_assigned_at?: string | null
          max_open_tickets?: number
          timezone?: string
          user_id: string
          workday_end?: string
          workday_start?: string
          working_days?: number[]
        }
        Update: {
          account_id?: string
          auto_assign?: boolean
          availability?: Database["public"]["Enums"]["ticket_availability"]
          category_ids?: string[]
          created_at?: string
          last_assigned_at?: string | null
          max_open_tickets?: number
          timezone?: string
          user_id?: string
          workday_end?: string
          workday_start?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_agents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          account_id: string
          active: boolean
          created_at: string
          default_priority: Database["public"]["Enums"]["ticket_priority"]
          id: string
          is_fallback: boolean
          name: string
          slug: string
        }
        Insert: {
          account_id: string
          active?: boolean
          created_at?: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          id?: string
          is_fallback?: boolean
          name: string
          slug: string
        }
        Update: {
          account_id?: string
          active?: boolean
          created_at?: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          id?: string
          is_fallback?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_category_rules: {
        Row: {
          account_id: string
          category_id: string
          created_at: string
          id: string
          term: string
          weight: number
        }
        Insert: {
          account_id: string
          category_id: string
          created_at?: string
          id?: string
          term: string
          weight?: number
        }
        Update: {
          account_id?: string
          category_id?: string
          created_at?: string
          id?: string
          term?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_category_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          account_id: string
          actor_id: string | null
          created_at: string
          detail: Json
          from_value: string | null
          id: number
          ticket_id: string
          to_value: string | null
          type: Database["public"]["Enums"]["ticket_event_type"]
        }
        Insert: {
          account_id: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          from_value?: string | null
          id?: never
          ticket_id: string
          to_value?: string | null
          type: Database["public"]["Enums"]["ticket_event_type"]
        }
        Update: {
          account_id?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          from_value?: string | null
          id?: never
          ticket_id?: string
          to_value?: string | null
          type?: Database["public"]["Enums"]["ticket_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          account_id: string
          assignee_id: string | null
          category_confidence: number | null
          category_id: string | null
          category_source:
            | Database["public"]["Enums"]["ticket_category_source"]
            | null
          closed_at: string | null
          created_at: string
          description: string
          first_responded_at: string | null
          first_response_breached_at: string | null
          first_response_due_at: string
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolution_breached_at: string | null
          resolution_due_at: string
          resolved_at: string | null
          search_text: unknown
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assignee_id?: string | null
          category_confidence?: number | null
          category_id?: string | null
          category_source?:
            | Database["public"]["Enums"]["ticket_category_source"]
            | null
          closed_at?: string | null
          created_at?: string
          description: string
          first_responded_at?: string | null
          first_response_breached_at?: string | null
          first_response_due_at: string
          id?: string
          number?: never
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolution_breached_at?: string | null
          resolution_due_at: string
          resolved_at?: string | null
          search_text?: unknown
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assignee_id?: string | null
          category_confidence?: number | null
          category_id?: string | null
          category_source?:
            | Database["public"]["Enums"]["ticket_category_source"]
            | null
          closed_at?: string | null
          created_at?: string
          description?: string
          first_responded_at?: string | null
          first_response_breached_at?: string | null
          first_response_due_at?: string
          id?: string
          number?: never
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id?: string
          resolution_breached_at?: string | null
          resolution_due_at?: string
          resolved_at?: string | null
          search_text?: unknown
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users_by_accounts: {
        Row: {
          account_id: string
          role: string
          user_id: string
        }
        Insert: {
          account_id: string
          role: string
          user_id: string
        }
        Update: {
          account_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_by_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_assign_ticket: { Args: { ticket: string }; Returns: string }
      claim_ticket: { Args: { ticket: string }; Returns: boolean }
      complete_job: {
        Args: { message_id: number; receipt: number }
        Returns: boolean
      }
      configure_support_agent: {
        Args: {
          agent_timezone: string
          auto: boolean
          categories?: string[]
          day_end: string
          day_start: string
          days: number[]
          max_open: number
          member: string
          target_account: string
        }
        Returns: boolean
      }
      create_account: {
        Args: { account_name: string; agent_timezone?: string }
        Returns: string
      }
      create_ticket: {
        Args: {
          category?: string
          confidence?: number
          evidence?: Json
          source?: Database["public"]["Enums"]["ticket_category_source"]
          suggested?: string
          target_account: string
          ticket_description: string
          ticket_title: string
        }
        Returns: Json
      }
      enqueue_job: {
        Args: { body: string; request_key: string; target_account: string }
        Returns: string
      }
      fail_job: {
        Args: { message_id: number; reason: string; receipt: number }
        Returns: boolean
      }
      invite_account_member: {
        Args: {
          agent_timezone?: string
          make_agent?: boolean
          member_email: string
          target_account: string
        }
        Returns: string
      }
      is_account_member: { Args: { target_account: string }; Returns: boolean }
      is_ticket_agent: { Args: { target_account: string }; Returns: boolean }
      pending_ticket_assignments: {
        Args: { batch?: number }
        Returns: {
          account_id: string
          category_id: string
          id: string
        }[]
      }
      read_jobs: {
        Args: { batch_size?: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      safe_timezone: { Args: { candidate: string }; Returns: string }
      seed_support_desk: {
        Args: { target_account: string }
        Returns: undefined
      }
      set_support_agent: {
        Args: {
          agent_timezone?: string
          enabled: boolean
          member: string
          target_account: string
        }
        Returns: boolean
      }
      set_ticket_category: {
        Args: { category: string; ticket: string }
        Returns: boolean
      }
      set_ticket_priority: {
        Args: {
          next_priority: Database["public"]["Enums"]["ticket_priority"]
          ticket: string
        }
        Returns: boolean
      }
      set_ticket_status: {
        Args: {
          next_status: Database["public"]["Enums"]["ticket_status"]
          ticket: string
        }
        Returns: boolean
      }
      support_coverage_deadline: {
        Args: { minutes: number; start_at: string; target_account: string }
        Returns: string
      }
      sweep_ticket_sla: {
        Args: { batch?: number }
        Returns: {
          first_response: number
          resolution: number
        }[]
      }
      ticket_metrics: { Args: { target_account: string }; Returns: Json }
      update_agent_shift: {
        Args: {
          agent_timezone: string
          auto: boolean
          day_end: string
          day_start: string
          days: number[]
          max_open: number
          next_availability: Database["public"]["Enums"]["ticket_availability"]
          target_account: string
        }
        Returns: boolean
      }
    }
    Enums: {
      job_status: "queued" | "completed" | "failed"
      ticket_availability: "available" | "busy" | "offline"
      ticket_category_source: "requester" | "auto" | "agent"
      ticket_event_type:
        | "created"
        | "classified"
        | "assigned"
        | "status_changed"
        | "priority_changed"
        | "recategorized"
        | "sla_breached"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "new" | "assigned" | "in_progress" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_status: ["queued", "completed", "failed"],
      ticket_availability: ["available", "busy", "offline"],
      ticket_category_source: ["requester", "auto", "agent"],
      ticket_event_type: [
        "created",
        "classified",
        "assigned",
        "status_changed",
        "priority_changed",
        "recategorized",
        "sla_breached",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["new", "assigned", "in_progress", "resolved", "closed"],
    },
  },
} as const

