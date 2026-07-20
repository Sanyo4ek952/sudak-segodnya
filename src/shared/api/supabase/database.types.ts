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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      organization_applications: {
        Row: {
          address: string | null
          admin_comment: string | null
          applicant_id: string
          category_id: string | null
          category_name: string | null
          confirmation_info: string | null
          created_at: string
          description: string | null
          id: string
          organization_id: string | null
          organization_name: string | null
          phone: string | null
          relationship: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["organization_application_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_comment?: string | null
          applicant_id?: string
          category_id?: string | null
          category_name?: string | null
          confirmation_info?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          organization_name?: string | null
          phone?: string | null
          relationship?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["organization_application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_comment?: string | null
          applicant_id?: string
          category_id?: string | null
          category_name?: string | null
          confirmation_info?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          organization_name?: string | null
          phone?: string | null
          relationship?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["organization_application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_applications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          category_id: string | null
          contact_links: Json
          cover_path: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_path: string | null
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          category_id?: string | null
          contact_links?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_path?: string | null
          name: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          category_id?: string | null
          contact_links?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_organization_application: {
        Args: { application_id: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      is_org_owner: { Args: { org_id: string }; Returns: boolean }
      reject_organization_application: {
        Args: { application_id: string; admin_comment: string }
        Returns: Json
      }
      request_organization_application_changes: {
        Args: { application_id: string; admin_comment: string }
        Returns: Json
      }
      submit_organization_application: {
        Args: { application_id: string }
        Returns: Database["public"]["Tables"]["organization_applications"]["Row"]
      }
    }
    Enums: {
      organization_application_status:
        | "draft"
        | "submitted"
        | "needs_changes"
        | "approved"
        | "rejected"
      organization_member_role: "owner" | "manager"
      organization_status:
        | "draft"
        | "pending"
        | "active"
        | "needs_changes"
        | "rejected"
        | "blocked"
      profile_role: "user" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      organization_application_status: [
        "draft",
        "submitted",
        "needs_changes",
        "approved",
        "rejected",
      ],
      organization_member_role: ["owner", "manager"],
      organization_status: [
        "draft",
        "pending",
        "active",
        "needs_changes",
        "rejected",
        "blocked",
      ],
      profile_role: ["user", "admin"],
    },
  },
} as const
