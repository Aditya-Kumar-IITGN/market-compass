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
      alert_events: {
        Row: {
          alert_id: string
          fired_at: string
          id: string
          message: string
          price: number
          seen: boolean
          user_id: string
        }
        Insert: {
          alert_id: string
          fired_at?: string
          id?: string
          message: string
          price: number
          seen?: boolean
          user_id: string
        }
        Update: {
          alert_id?: string
          fired_at?: string
          id?: string
          message?: string
          price?: number
          seen?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          channels: string[]
          cooldown_sec: number
          created_at: string
          enabled: boolean
          id: string
          interval: string
          last_fired_at: string | null
          name: string
          rule: Json
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          cooldown_sec?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval?: string
          last_fired_at?: string | null
          name: string
          rule: Json
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          cooldown_sec?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval?: string
          last_fired_at?: string | null
          name?: string
          rule?: Json
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backtest_runs: {
        Row: {
          equity: Json
          id: string
          interval: string
          metrics: Json
          ran_at: string
          strategy_id: string | null
          symbol: string
          trades: Json
          user_id: string
        }
        Insert: {
          equity: Json
          id?: string
          interval: string
          metrics: Json
          ran_at?: string
          strategy_id?: string | null
          symbol: string
          trades: Json
          user_id: string
        }
        Update: {
          equity?: Json
          id?: string
          interval?: string
          metrics?: Json
          ran_at?: string
          strategy_id?: string | null
          symbol?: string
          trades?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_runs_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_schedules: {
        Row: {
          cadence_minutes: number
          created_at: string
          enabled: boolean
          id: string
          interval: string
          last_run_at: string | null
          strategy_id: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval: string
          last_run_at?: string | null
          strategy_id: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval?: string
          last_run_at?: string | null
          strategy_id?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_schedules_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_accounts: {
        Row: {
          cash: number
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cash?: number
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          cash?: number
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_bots: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          id: string
          interval: string
          last_bar_time: number | null
          strategy_id: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          interval?: string
          last_bar_time?: number | null
          strategy_id: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          interval?: string
          last_bar_time?: number | null
          strategy_id?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_bots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "paper_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_bots_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_orders: {
        Row: {
          account_id: string
          created_at: string
          id: string
          price: number
          qty: number
          side: string
          source: string
          status: string
          strategy_id: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          price: number
          qty: number
          side: string
          source?: string
          status?: string
          strategy_id?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          price?: number
          qty?: number
          side?: string
          source?: string
          status?: string
          strategy_id?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "paper_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_orders_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_positions: {
        Row: {
          account_id: string
          avg_price: number
          id: string
          qty: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          avg_price?: number
          id?: string
          qty?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          avg_price?: number
          id?: string
          qty?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "paper_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string
          definition: Json
          id: string
          interval: string
          name: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          definition: Json
          id?: string
          interval?: string
          name: string
          symbol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          interval?: string
          name?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
