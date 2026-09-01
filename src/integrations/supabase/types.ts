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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          family_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          family_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          family_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          family_id: string
          goal_id: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          family_id: string
          goal_id?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          family_id?: string
          goal_id?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          family_id: string
          id: string
          monthly_limit: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          family_id: string
          id?: string
          monthly_limit?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          family_id?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_members: {
        Row: {
          amount_assigned: number
          debt_id: string
          family_id: string | null
          id: string
          percentage: number | null
          user_id: string
        }
        Insert: {
          amount_assigned: number
          debt_id: string
          family_id?: string | null
          id?: string
          percentage?: number | null
          user_id: string
        }
        Update: {
          amount_assigned?: number
          debt_id?: string
          family_id?: string | null
          id?: string
          percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_members_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          created_by: string
          created_date: string
          cuota_amount: number | null
          current_cuota: number | null
          debt_type: Database["public"]["Enums"]["debt_type"]
          document_note: string | null
          document_url: string | null
          due_date: string | null
          entity: string
          family_id: string
          id: string
          interest_rate: number
          name: string
          notes: string | null
          settled_at: string | null
          settled_by: string | null
          settlement_due_at: string | null
          settlement_proof_url: string | null
          status: Database["public"]["Enums"]["debt_status"]
          total_amount: number
          total_cuotas: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_date?: string
          cuota_amount?: number | null
          current_cuota?: number | null
          debt_type: Database["public"]["Enums"]["debt_type"]
          document_note?: string | null
          document_url?: string | null
          due_date?: string | null
          entity: string
          family_id: string
          id?: string
          interest_rate?: number
          name: string
          notes?: string | null
          settled_at?: string | null
          settled_by?: string | null
          settlement_due_at?: string | null
          settlement_proof_url?: string | null
          status?: Database["public"]["Enums"]["debt_status"]
          total_amount: number
          total_cuotas?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_date?: string
          cuota_amount?: number | null
          current_cuota?: number | null
          debt_type?: Database["public"]["Enums"]["debt_type"]
          document_note?: string | null
          document_url?: string | null
          due_date?: string | null
          entity?: string
          family_id?: string
          id?: string
          interest_rate?: number
          name?: string
          notes?: string | null
          settled_at?: string | null
          settled_by?: string | null
          settlement_due_at?: string | null
          settlement_proof_url?: string | null
          status?: Database["public"]["Enums"]["debt_status"]
          total_amount?: number
          total_cuotas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string | null
          expense_date: string
          family_id: string
          id: string
          paid_by: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          family_id: string
          id?: string
          paid_by: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          family_id?: string
          id?: string
          paid_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          monthly_income: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          monthly_income?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          monthly_income?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          family_id: string
          id: string
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          family_id: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          family_id?: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          family_id: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          type?: Database["public"]["Enums"]["notif_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          debt_id: string
          family_id: string | null
          id: string
          notes: string | null
          payment_date: string
          proof_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          debt_id: string
          family_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          proof_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          debt_id?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          proof_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      savings_contributions: {
        Row: {
          amount: number
          contribution_date: string
          created_at: string
          created_by: string | null
          family_id: string | null
          goal_id: string
          id: string
          kind: string
          notes: string | null
          proof_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contribution_date?: string
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          goal_id: string
          id?: string
          kind?: string
          notes?: string | null
          proof_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contribution_date?: string
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          goal_id?: string
          id?: string
          kind?: string
          notes?: string | null
          proof_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_contributions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goal_members: {
        Row: {
          created_at: string
          family_id: string | null
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string | null
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string | null
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goal_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goal_members_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          broken_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          current_amount: number
          due_date: string | null
          family_id: string
          goal_kind: string
          id: string
          is_challenge: boolean
          name: string
          period_end: string | null
          period_start: string | null
          target_amount: number
        }
        Insert: {
          broken_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          current_amount?: number
          due_date?: string | null
          family_id: string
          goal_kind?: string
          id?: string
          is_challenge?: boolean
          name: string
          period_end?: string | null
          period_start?: string | null
          target_amount: number
        }
        Update: {
          broken_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          current_amount?: number
          due_date?: string | null
          family_id?: string
          goal_kind?: string
          id?: string
          is_challenge?: boolean
          name?: string
          period_end?: string | null
          period_start?: string | null
          target_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_save_family: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_family: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      close_expired_challenges: { Args: never; Returns: number }
      family_role: {
        Args: { _family_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      invitation_info: {
        Args: { _token: string }
        Returns: {
          email: string
          family_name: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          valid: boolean
        }[]
      }
      is_family_admin: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      is_family_member: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      notify_family_admins: {
        Args: {
          _family_id: string
          _message: string
          _related_id: string
          _type: string
        }
        Returns: undefined
      }
      redeem_invitation: {
        Args: { _token: string }
        Returns: {
          out_family_id: string
          out_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      use_reserve_for_debt: {
        Args: {
          _amount: number
          _debt_id: string
          _goal_id: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "miembro" | "invitado" | "educativo"
      debt_status: "activa" | "pagada" | "mora"
      debt_type: "unico" | "cuotas"
      expense_category:
        | "mercado"
        | "transporte"
        | "salud"
        | "servicios"
        | "otros"
      notif_type:
        | "nueva_deuda"
        | "por_vencer"
        | "en_mora"
        | "abono_registrado"
        | "meta_completada"
        | "pago_total_pendiente"
        | "riesgo_mora"
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
      app_role: ["admin", "miembro", "invitado", "educativo"],
      debt_status: ["activa", "pagada", "mora"],
      debt_type: ["unico", "cuotas"],
      expense_category: [
        "mercado",
        "transporte",
        "salud",
        "servicios",
        "otros",
      ],
      notif_type: [
        "nueva_deuda",
        "por_vencer",
        "en_mora",
        "abono_registrado",
        "meta_completada",
        "pago_total_pendiente",
        "riesgo_mora",
      ],
    },
  },
} as const
