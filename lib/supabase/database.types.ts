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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      celebrations: {
        Row: {
          celebration_date: string
          celebration_month: number
          celebration_year: number
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          schedule_rule: string
          status: string
          updated_at: string
        }
        Insert: {
          celebration_date: string
          celebration_month: number
          celebration_year: number
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          schedule_rule?: string
          status?: string
          updated_at?: string
        }
        Update: {
          celebration_date?: string
          celebration_month?: number
          celebration_year?: number
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          schedule_rule?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_submissions: {
        Row: {
          birth_day: number
          birth_month: number
          birth_year: number | null
          created_at: string
          display_name: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          member_id: string | null
          organization_id: string
          phone: string | null
          photo_path: string | null
          registration_link_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          birth_day: number
          birth_month: number
          birth_year?: number | null
          created_at?: string
          display_name: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          member_id?: string | null
          organization_id: string
          phone?: string | null
          photo_path?: string | null
          registration_link_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          birth_day?: number
          birth_month?: number
          birth_year?: number | null
          created_at?: string
          display_name?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          member_id?: string | null
          organization_id?: string
          phone?: string | null
          photo_path?: string | null
          registration_link_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_submissions_registration_link_id_fkey"
            columns: ["registration_link_id"]
            isOneToOne: false
            referencedRelation: "registration_links"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          birth_day: number
          birth_month: number
          birth_year: number | null
          created_at: string
          created_by: string | null
          department_id: string | null
          display_name: string
          email: string | null
          first_name: string | null
          group_id: string | null
          id: string
          is_active: boolean
          last_name: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_day: number
          birth_month: number
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          display_name: string
          email?: string | null
          first_name?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_day?: number
          birth_month?: number
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_department_tenant_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "members_group_tenant_fkey"
            columns: ["organization_id", "group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "members_organization_id_fkey"
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
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
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
          created_at: string
          created_by: string | null
          id: string
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          organization_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          organization_id: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          organization_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
      create_organization: {
        Args: { organization_name: string; organization_slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_registration_link: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["registration_link_state"]
        SetofOptions: {
          from: "*"
          to: "registration_link_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_organization_logo: {
        Args: { registration_token: string }
        Returns: string
      }
      get_public_registration: {
        Args: { registration_token: string }
        Returns: string
      }
      organization_logo_delete_allowed: {
        Args: { object_name: string }
        Returns: boolean
      }
      organization_logo_insert_allowed: {
        Args: { object_name: string }
        Returns: boolean
      }
      has_organization_role: {
        Args: { allowed_roles: string[]; org_id: string }
        Returns: boolean
      }
      is_organization_member: { Args: { org_id: string }; Returns: boolean }
      member_photo_write_allowed: {
        Args: { object_name: string }
        Returns: boolean
      }
      attach_registration_photo: {
        Args: { object_path: string; target_submission_id: string }
        Returns: boolean
      }
      registration_link_token: { Args: never; Returns: string }
      review_member_submission: {
        Args: { decision: string; submission_id: string }
        Returns: Database["public"]["CompositeTypes"]["member_submission_review_result"]
        SetofOptions: {
          from: "*"
          to: "member_submission_review_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_member_registration: {
        Args: {
          birth_day: number
          birth_month: number
          birth_year: number
          email: string
          first_name: string
          last_name: string
          phone: string
          registration_token: string
        }
        Returns: Database["public"]["CompositeTypes"]["member_registration_submit_result"]
        SetofOptions: {
          from: "*"
          to: "member_registration_submit_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_cast_uuid: { Args: { value: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      member_registration_submit_result: {
        success: boolean | null
        code: string | null
        submission_id: string | null
        organization_id: string | null
      }
      member_submission_review_result: {
        success: boolean | null
        code: string | null
        member_id: string | null
      }
      registration_link_state: {
        token: string | null
        is_enabled: boolean | null
      }
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
