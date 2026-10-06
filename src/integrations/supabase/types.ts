export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          preferences?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      bug_reports: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string; // UUID in database
          user_email: string | null;
          title: string | null;
          category: string;
          description: string;
          app_version: string | null;
          technical_info: Json | null;
          attachment_url: string | null;
          status: "nouveau" | "en_cours" | "resolu" | "non_resolu";
          developer_response: string | null;
          developer_response_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          user_email?: string | null;
          title?: string | null;
          category?: string;
          description: string;
          app_version?: string | null;
          technical_info?: Json | null;
          attachment_url?: string | null;
          status?: "novo" | "en_cours" | "resolu" | "non_resolu";
          developer_response?: string | null;
          developer_response_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          user_email?: string | null;
          title?: string | null;
          category?: string;
          description?: string;
          app_version?: string | null;
          technical_info?: Json | null;
          attachment_url?: string | null;
          status?: "nouveau" | "en_cours" | "resolu" | "non_resolu";
          developer_response?: string | null;
          developer_response_at?: string | null;
        };
        Relationships: [];
      };
      ingredient_analysis_jobs: {
        Row: {
          id: string;
          user_id: string; // UUID
          ingredient_name: string;
          image_url: string | null;
          status: "queued" | "processing" | "completed" | "failed";
          halal_status: string | null;
          analysis_result: Json | null;
          error_message: string | null;
          retry_count: number;
          locked_until: string | null;
          locked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ingredient_name: string;
          image_url?: string | null;
          status?: "queued" | "processing" | "completed" | "failed";
          halal_status?: string | null;
          analysis_result?: Json | null;
          error_message?: string | null;
          retry_count?: number;
          locked_until?: string | null;
          locked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ingredient_name?: string;
          image_url?: string | null;
          status?: "queued" | "processing" | "completed" | "failed";
          halal_status?: string | null;
          analysis_result?: Json | null;
          error_message?: string | null;
          retry_count?: number;
          locked_until?: string | null;
          locked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
