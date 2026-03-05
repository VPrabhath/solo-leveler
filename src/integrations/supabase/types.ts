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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      match_participants: {
        Row: {
          id: string
          joined_at: string
          match_id: string
          player_id: string
          problems_solved: number
          rank: number | null
          score: number
          streak: number
        }
        Insert: {
          id?: string
          joined_at?: string
          match_id: string
          player_id: string
          problems_solved?: number
          rank?: number | null
          score?: number
          streak?: number
        }
        Update: {
          id?: string
          joined_at?: string
          match_id?: string
          player_id?: string
          problems_solved?: number
          rank?: number | null
          score?: number
          streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          max_players: number
          problem_ids: string[] | null
          start_time: string | null
          status: Database["public"]["Enums"]["match_status"]
          time_limit_minutes: number
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          max_players?: number
          problem_ids?: string[] | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          time_limit_minutes?: number
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          max_players?: number
          problem_ids?: string[] | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          time_limit_minutes?: number
        }
        Relationships: []
      }
      problems: {
        Row: {
          constraints: string | null
          created_at: string
          created_by: string | null
          description: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          is_active: boolean
          memory_limit_mb: number
          tags: string[] | null
          test_cases: Json
          time_limit_seconds: number
          title: string
          updated_at: string
        }
        Insert: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_active?: boolean
          memory_limit_mb?: number
          tags?: string[] | null
          test_cases?: Json
          time_limit_seconds?: number
          title: string
          updated_at?: string
        }
        Update: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_active?: boolean
          memory_limit_mb?: number
          tags?: string[] | null
          test_cases?: Json
          time_limit_seconds?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          elo_rating: number
          id: string
          rank_tier: string
          total_matches: number
          updated_at: string
          user_id: string
          username: string
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          elo_rating?: number
          id?: string
          rank_tier?: string
          total_matches?: number
          updated_at?: string
          user_id: string
          username: string
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          elo_rating?: number
          id?: string
          rank_tier?: string
          total_matches?: number
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          code: string
          execution_time_ms: number | null
          id: string
          language: string
          match_id: string
          player_id: string
          problem_id: string
          result: Database["public"]["Enums"]["submission_result"]
          score: number
          submitted_at: string
          test_cases_passed: number
          test_cases_total: number
        }
        Insert: {
          code: string
          execution_time_ms?: number | null
          id?: string
          language?: string
          match_id: string
          player_id: string
          problem_id: string
          result?: Database["public"]["Enums"]["submission_result"]
          score?: number
          submitted_at?: string
          test_cases_passed?: number
          test_cases_total?: number
        }
        Update: {
          code?: string
          execution_time_ms?: number | null
          id?: string
          language?: string
          match_id?: string
          player_id?: string
          problem_id?: string
          result?: Database["public"]["Enums"]["submission_result"]
          score?: number
          submitted_at?: string
          test_cases_passed?: number
          test_cases_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "player"
      difficulty_level: "easy" | "medium" | "hard"
      match_status: "waiting" | "countdown" | "in_progress" | "finished"
      submission_result:
        | "pending"
        | "accepted"
        | "wrong_answer"
        | "runtime_error"
        | "time_limit"
        | "partial"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "player"],
      difficulty_level: ["easy", "medium", "hard"],
      match_status: ["waiting", "countdown", "in_progress", "finished"],
      submission_result: [
        "pending",
        "accepted",
        "wrong_answer",
        "runtime_error",
        "time_limit",
        "partial",
      ],
    },
  },
} as const
