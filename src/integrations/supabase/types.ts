export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_state: {
        Row: {
          payload: Json
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_people: {
        Row: {
          data: Json
          handle: string
          id: string
          name: string
        }
        Insert: {
          data: Json
          handle: string
          id: string
          name: string
        }
        Update: {
          data?: Json
          handle?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      demo_squad_members: {
        Row: {
          person_id: string
          squad_id: string
        }
        Insert: {
          person_id: string
          squad_id: string
        }
        Update: {
          person_id?: string
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_squad_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "demo_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "demo_squads"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_squads: {
        Row: {
          id: string
          leader_id: string | null
          name: string
        }
        Insert: {
          id: string
          leader_id?: string | null
          name: string
        }
        Update: {
          id?: string
          leader_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_squads_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "demo_people"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          content: Json
          created_at: string
          demo_id: string | null
          id: string
          owner_id: string | null
          quest_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          demo_id?: string | null
          id: string
          owner_id?: string | null
          quest_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          demo_id?: string | null
          id?: string
          owner_id?: string | null
          quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hearts: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hearts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          email: string
          handle: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          email?: string
          handle: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          email?: string
          handle?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quest_completions: {
        Row: {
          active: boolean
          completed_at: string
          quest_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          completed_at?: string
          quest_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          completed_at?: string
          quest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_completions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          archived: boolean
          content: Json
          created_at: string
          id: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content: Json
          created_at?: string
          id: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      squad_demo_members: {
        Row: {
          person_id: string
          squad_id: string
        }
        Insert: {
          person_id: string
          squad_id: string
        }
        Update: {
          person_id?: string
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_demo_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "demo_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_demo_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_invites: {
        Row: {
          created_at: string
          id: string
          invitee_email: string
          invitee_id: string | null
          invitee_name: string | null
          inviter_id: string
          inviter_name: string
          responded_at: string | null
          squad_key: string
          squad_name: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_email: string
          invitee_id?: string | null
          invitee_name?: string | null
          inviter_id: string
          inviter_name: string
          responded_at?: string | null
          squad_key: string
          squad_name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_email?: string
          invitee_id?: string | null
          invitee_name?: string | null
          inviter_id?: string
          inviter_name?: string
          responded_at?: string | null
          squad_key?: string
          squad_name?: string
          status?: string
        }
        Relationships: []
      }
      squad_members: {
        Row: {
          joined_at: string
          squad_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          squad_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          name?: string
        }
        Relationships: []
      }
      student_verifications: {
        Row: {
          email: string
          user_id: string
          verified_at: string
        }
        Insert: {
          email: string
          user_id: string
          verified_at?: string
        }
        Update: {
          email?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      verification_limits: {
        Row: {
          attempts: number
          sends: number
          user_id: string
          window_start: string
        }
        Insert: {
          attempts?: number
          sends?: number
          user_id: string
          window_start?: string
        }
        Update: {
          attempts?: number
          sends?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          active: boolean
          awarded_at: string
          kind: string
          label: string
          ref_id: string
          user_id: string
          xp: number
        }
        Insert: {
          active?: boolean
          awarded_at?: string
          kind: string
          label: string
          ref_id: string
          user_id: string
          xp: number
        }
        Update: {
          active?: boolean
          awarded_at?: string
          kind?: string
          label?: string
          ref_id?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_post: { Args: { post: string }; Returns: boolean }
      completion_week_streak: { Args: { person: string }; Returns: number }
      is_squad_member: {
        Args: { _squad: string; _user: string }
        Returns: boolean
      }
      people_directory: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          completed: number
          created: number
          handle: string
          id: string
          name: string
          week_xp: number
          weekly_streak: number
          xp: number
        }[]
      }
      profile_is_public: { Args: { person: string }; Returns: boolean }
      publish_quest: { Args: { quest_content: Json }; Returns: undefined }
      read_feed: { Args: never; Returns: Json }
      save_account_state: {
        Args: { expected_revision: number; new_payload: Json }
        Returns: number
      }
      sync_social: {
        Args: { comments: Json; heart_ids: Json; posts: Json }
        Returns: Json
      }
      take_verification_attempt: {
        Args: { checking: boolean; person: string }
        Returns: boolean
      }
      valid_post_document: { Args: { p: Json }; Returns: boolean }
      valid_quest_document: { Args: { q: Json }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
