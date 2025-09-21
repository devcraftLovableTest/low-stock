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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      bulk_action_items: {
        Row: {
          bulk_action_id: string
          created_at: string
          id: string
          inventory_item_id: string
          new_compare_at_price: number | null
          new_price: number | null
          original_compare_at_price: number | null
          original_price: number | null
        }
        Insert: {
          bulk_action_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          new_compare_at_price?: number | null
          new_price?: number | null
          original_compare_at_price?: number | null
          original_price?: number | null
        }
        Update: {
          bulk_action_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          new_compare_at_price?: number | null
          new_price?: number | null
          original_compare_at_price?: number | null
          original_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_action_items_bulk_action_id_fkey"
            columns: ["bulk_action_id"]
            isOneToOne: false
            referencedRelation: "bulk_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_action_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_actions: {
        Row: {
          action_name: string
          action_type: string
          created_at: string
          created_by: string | null
          id: string
          new_compare_at_price: number | null
          new_price: number | null
          product_count: number | null
          reverted_at: string | null
          shop_domain: string
        }
        Insert: {
          action_name: string
          action_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_compare_at_price?: number | null
          new_price?: number | null
          product_count?: number | null
          reverted_at?: string | null
          shop_domain: string
        }
        Update: {
          action_name?: string
          action_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_compare_at_price?: number | null
          new_price?: number | null
          product_count?: number | null
          reverted_at?: string | null
          shop_domain?: string
        }
        Relationships: []
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          id: string
          inventory_item_id: string
          message: string
          sent_at: string
          shop_domain: string
        }
        Insert: {
          alert_type: string
          id?: string
          inventory_item_id: string
          message: string
          sent_at?: string
          shop_domain: string
        }
        Update: {
          alert_type?: string
          id?: string
          inventory_item_id?: string
          message?: string
          sent_at?: string
          shop_domain?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          inventory_quantity: number | null
          low_stock_threshold: number | null
          price: number | null
          shop_domain: string
          shop_id: string | null
          shopify_product_id: number | null
          shopify_variant_id: number | null
          sku: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          inventory_quantity?: number | null
          low_stock_threshold?: number | null
          price?: number | null
          shop_domain: string
          shop_id?: string | null
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          inventory_quantity?: number | null
          low_stock_threshold?: number | null
          price?: number | null
          shop_domain?: string
          shop_id?: string | null
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          id: string
          return_url: string | null
          shop_domain: string
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          return_url?: string | null
          shop_domain: string
          state: string
        }
        Update: {
          created_at?: string
          id?: string
          return_url?: string | null
          shop_domain?: string
          state?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          access_token: string
          email: string | null
          id: string
          installed_at: string
          shop_domain: string
          shop_name: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          email?: string | null
          id?: string
          installed_at?: string
          shop_domain: string
          shop_name?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          email?: string | null
          id?: string
          installed_at?: string
          shop_domain?: string
          shop_name?: string | null
          updated_at?: string
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
