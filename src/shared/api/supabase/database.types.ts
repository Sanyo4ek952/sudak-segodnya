export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      analytics_events: {
        Row: {
          anonymous_id: string | null
          created_at: string
          event_name: Database["public"]["Enums"]["analytics_event_name"]
          id: string
          menu_item_id: string | null
          metadata: Json
          organization_id: string | null
          publication_id: string | null
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          created_at?: string
          event_name: Database["public"]["Enums"]["analytics_event_name"]
          id?: string
          menu_item_id?: string | null
          metadata?: Json
          organization_id?: string | null
          publication_id?: string | null
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          created_at?: string
          event_name?: Database["public"]["Enums"]["analytics_event_name"]
          id?: string
          menu_item_id?: string | null
          metadata?: Json
          organization_id?: string | null
          publication_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      important_announcements: {
        Row: {
          active_from: string | null
          active_until: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          publication_id: string | null
          status: Database["public"]["Enums"]["important_announcement_status"]
          title: string
          updated_at: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          created_at?: string
          created_by?: string
          description: string
          id?: string
          publication_id?: string | null
          status?: Database["public"]["Enums"]["important_announcement_status"]
          title: string
          updated_at?: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          publication_id?: string | null
          status?: Database["public"]["Enums"]["important_announcement_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_announcements_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      inaccuracy_reports: {
        Row: {
          admin_comment: string | null
          comment: string | null
          created_at: string
          id: string
          publication_id: string
          reason: Database["public"]["Enums"]["inaccuracy_report_reason"]
          reporter_fingerprint: string | null
          reporter_user_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["inaccuracy_report_status"]
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          publication_id: string
          reason: Database["public"]["Enums"]["inaccuracy_report_reason"]
          reporter_fingerprint?: string | null
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["inaccuracy_report_status"]
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          publication_id?: string
          reason?: Database["public"]["Enums"]["inaccuracy_report_reason"]
          reporter_fingerprint?: string | null
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["inaccuracy_report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inaccuracy_reports_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          organization_id: string
          price_text: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          organization_id: string
          price_text?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          organization_id?: string
          price_text?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          application_id: string | null
          bucket_id: string
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          menu_item_id: string | null
          mime_type: string | null
          organization_id: string | null
          publication_id: string | null
          purpose: Database["public"]["Enums"]["media_asset_purpose"]
          size_bytes: number | null
          sort_order: number
          storage_path: string
          updated_at: string
          uploaded_by: string
          visibility: Database["public"]["Enums"]["media_asset_visibility"]
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          application_id?: string | null
          bucket_id: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          menu_item_id?: string | null
          mime_type?: string | null
          organization_id?: string | null
          publication_id?: string | null
          purpose: Database["public"]["Enums"]["media_asset_purpose"]
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string
          visibility?: Database["public"]["Enums"]["media_asset_visibility"]
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          application_id?: string | null
          bucket_id?: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          menu_item_id?: string | null
          mime_type?: string | null
          organization_id?: string | null
          publication_id?: string | null
          purpose?: Database["public"]["Enums"]["media_asset_purpose"]
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          visibility?: Database["public"]["Enums"]["media_asset_visibility"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "organization_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_applications: {
        Row: {
          address: string | null
          admin_comment: string | null
          applicant_id: string
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
          type_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_comment?: string | null
          applicant_id?: string
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
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_comment?: string | null
          applicant_id?: string
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
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_applications_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "organization_types"
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
      organization_types: {
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
      organization_member_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["organization_member_role"]
          status: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          contact_links: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_public_update_at: string | null
          latitude: number | null
          longitude: number | null
          moderation_comment: string | null
          name: string
          pending_type_id: string | null
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          type_id: string
          type_change_requested_at: string | null
          type_change_requested_by: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          contact_links?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_public_update_at?: string | null
          latitude?: number | null
          longitude?: number | null
          moderation_comment?: string | null
          name: string
          pending_type_id?: string | null
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          type_id: string
          type_change_requested_at?: string | null
          type_change_requested_by?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          contact_links?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_public_update_at?: string | null
          latitude?: number | null
          longitude?: number | null
          moderation_comment?: string | null
          name?: string
          pending_type_id?: string | null
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          type_id?: string
          type_change_requested_at?: string | null
          type_change_requested_by?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_pending_type_id_fkey"
            columns: ["pending_type_id"]
            isOneToOne: false
            referencedRelation: "organization_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_category_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "organization_types"
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
      publication_categories: {
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
      publication_schedules: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          publication_id: string
          schedule_text: string
          sort_order: number
          starts_at: string | null
          timezone: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          publication_id: string
          schedule_text: string
          sort_order?: number
          starts_at?: string | null
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          publication_id?: string
          schedule_text?: string
          sort_order?: number
          starts_at?: string | null
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_schedules_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          age_limit: string | null
          author_id: string
          cancelled_at: string | null
          category_id: string
          client_request_id: string | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_free: boolean
          moderation_comment: string | null
          organization_id: string
          place: string | null
          price_text: string | null
          published_at: string | null
          publish_at: string | null
          schedule_error: string | null
          schedule_last_attempt_at: string | null
          slug: string
          sort_published_at: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
          title: string
          type: Database["public"]["Enums"]["publication_type"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          age_limit?: string | null
          author_id?: string
          cancelled_at?: string | null
          category_id: string
          client_request_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean
          moderation_comment?: string | null
          organization_id: string
          place?: string | null
          price_text?: string | null
          published_at?: string | null
          publish_at?: string | null
          schedule_error?: string | null
          schedule_last_attempt_at?: string | null
          slug: string
          sort_published_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          title: string
          type: Database["public"]["Enums"]["publication_type"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          age_limit?: string | null
          author_id?: string
          cancelled_at?: string | null
          category_id?: string
          client_request_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean
          moderation_comment?: string | null
          organization_id?: string
          place?: string | null
          price_text?: string | null
          published_at?: string | null
          publish_at?: string | null
          schedule_error?: string | null
          schedule_last_attempt_at?: string | null
          slug?: string
          sort_published_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          title?: string
          type?: Database["public"]["Enums"]["publication_type"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "publication_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      admin_moderate_organization: {
        Args: {
          p_organization_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: Database["public"]["Tables"]["organizations"]["Row"]
      }
      admin_moderate_publication: {
        Args: {
          p_publication_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["publication_status"]
        }
        Returns: Database["public"]["Tables"]["publications"]["Row"]
      }
      approve_organization_application: {
        Args: { application_id: string }
        Returns: Json
      }
      create_inaccuracy_report: {
        Args: {
          comment: string
          publication_id: string
          reason: string
          reporter_fingerprint: string
        }
        Returns: {
          admin_comment: string | null
          comment: string | null
          created_at: string
          id: string
          publication_id: string
          reason: string
          reporter_fingerprint: string | null
          reporter_user_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["inaccuracy_report_status"]
          updated_at: string
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      is_org_owner: { Args: { org_id: string }; Returns: boolean }
      is_public_publication: {
        Args: {
          publication_row: Database["public"]["Tables"]["publications"]["Row"]
        }
        Returns: boolean
      }
      invite_organization_representative: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role?: Database["public"]["Enums"]["organization_member_role"]
        }
        Returns: Json
      }
      list_organization_representatives: {
        Args: { p_organization_id: string }
        Returns: {
          added_at: string
          display_name: string | null
          email: string | null
          is_active: boolean
          member_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }[]
      }
      make_organization_slug: {
        Args: { application_id: string; name: string }
        Returns: string
      }
      list_ranked_publication_ids: {
        Args: {
          p_cursor_id?: string | null
          p_cursor_key?: number | null
          p_cursor_rank?: number | null
          p_filter?: string
          p_limit?: number
          p_reference?: string
        }
        Returns: {
          publication_id: string
          relevance_key: number
          relevance_rank: number
        }[]
      }
      manage_organization_representative: {
        Args: {
          p_action: string
          p_member_id: string
          p_organization_id: string
          p_role?: Database["public"]["Enums"]["organization_member_role"] | null
        }
        Returns: Database["public"]["Tables"]["organization_members"]["Row"]
      }
      reject_organization_application: {
        Args: { admin_comment: string; application_id: string }
        Returns: Json
      }
      request_organization_application_changes: {
        Args: { admin_comment: string; application_id: string }
        Returns: Json
      }
      review_organization_type_change: {
        Args: {
          p_approve: boolean
          p_organization_id: string
          p_reason: string
        }
        Returns: Database["public"]["Tables"]["organizations"]["Row"]
      }
      revoke_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_member_publication: {
        Args: {
          p_age_limit: string | null
          p_category_id: string
          p_client_request_id: string | null
          p_contact_phone: string | null
          p_description: string | null
          p_ends_at: string | null
          p_intent: string
          p_is_free: boolean
          p_organization_id: string
          p_place: string | null
          p_price_text: string | null
          p_publication_id: string | null
          p_publish_at: string | null
          p_schedule_entries: Json
          p_starts_at: string | null
          p_title: string
          p_type: Database["public"]["Enums"]["publication_type"]
          p_valid_until: string | null
        }
        Returns: Database["public"]["Tables"]["publications"]["Row"]
      }
      submit_organization_application: {
        Args: { application_id: string }
        Returns: {
          address: string | null
          admin_comment: string | null
          applicant_id: string
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
          type_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      track_public_analytics_event: {
        Args: {
          p_anonymous_id?: string | null
          p_event_name: string
          p_menu_item_id?: string | null
          p_metadata?: Json
          p_organization_id?: string | null
          p_publication_id?: string | null
        }
        Returns: string
      }
      transfer_organization_ownership: {
        Args: {
          p_keep_current_owner?: boolean
          p_organization_id: string
          p_target_member_id: string
        }
        Returns: Json
      }
      update_member_organization_profile: {
        Args: {
          address: string
          description: string
          name: string
          organization_id: string
          phone: string
          working_hours: string
        }
        Returns: {
          address: string | null
          contact_links: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_public_update_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          type_id: string
          updated_at: string
          working_hours: string | null
        }
      }
      update_member_organization_profile_v2: {
        Args: {
          p_address: string
          p_contact_links: Json
          p_description: string
          p_latitude: number | null
          p_longitude: number | null
          p_name: string
          p_organization_id: string
          p_phone: string
          p_type_id: string
          p_working_hours: string
        }
        Returns: Database["public"]["Tables"]["organizations"]["Row"]
      }
      transition_member_publication: {
        Args: {
          p_publication_id: string
          p_transition: string
        }
        Returns: Database["public"]["Tables"]["publications"]["Row"]
      }
    }
    Enums: {
      analytics_event_name:
        | "organization_view"
        | "organization_click"
        | "publication_view"
        | "phone_click"
        | "route_click"
        | "menu_open"
        | "favorite_add"
        | "share"
        | "calendar"
      important_announcement_status: "draft" | "active" | "expired" | "hidden"
      inaccuracy_report_reason:
        | "wrong_datetime"
        | "wrong_price"
        | "cancelled"
        | "wrong_address"
        | "outdated"
        | "other"
      inaccuracy_report_status: "new" | "reviewing" | "resolved" | "rejected"
      media_asset_purpose:
        | "organization_logo"
        | "organization_cover"
        | "application_confirmation"
        | "publication_photo"
        | "menu_item_photo"
      media_asset_visibility: "public" | "private"
      organization_application_status:
        | "draft"
        | "submitted"
        | "needs_changes"
        | "approved"
        | "rejected"
      organization_invitation_status: "pending" | "accepted" | "revoked" | "expired"
      organization_member_role: "owner" | "manager"
      organization_status:
        | "draft"
        | "pending"
        | "active"
        | "needs_changes"
        | "rejected"
        | "blocked"
      profile_role: "user" | "admin"
      publication_status:
        | "draft"
        | "scheduled"
        | "moderation"
        | "published"
        | "cancelled"
        | "completed"
        | "hidden"
        | "blocked"
      publication_type: "event" | "announcement" | "promo" | "regular" | "news"
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
      analytics_event_name: [
        "organization_view",
        "organization_click",
        "publication_view",
        "phone_click",
        "route_click",
        "menu_open",
        "favorite_add",
        "share",
        "calendar",
      ],
      important_announcement_status: ["draft", "active", "expired", "hidden"],
      inaccuracy_report_reason: [
        "wrong_datetime",
        "wrong_price",
        "cancelled",
        "wrong_address",
        "outdated",
        "other",
      ],
      inaccuracy_report_status: ["new", "reviewing", "resolved", "rejected"],
      media_asset_purpose: [
        "organization_logo",
        "organization_cover",
        "application_confirmation",
        "publication_photo",
        "menu_item_photo",
      ],
      media_asset_visibility: ["public", "private"],
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
      publication_status: [
        "draft",
        "scheduled",
        "moderation",
        "published",
        "cancelled",
        "completed",
        "hidden",
        "blocked",
      ],
      publication_type: ["event", "announcement", "promo", "regular", "news"],
    },
  },
} as const
