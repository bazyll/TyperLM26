export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "user" | "admin";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
export type MatchStage = "league" | "playoff" | "round_of_16" | "quarter_finals" | "semi_finals" | "final";
export type ScoringCategory = "exact" | "diff" | "outcome" | "incorrect";
export type SpecialStatus = "open" | "locked" | "settled";
export type SpecialTargetType = "team" | "player";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          auth_email: string;
          username: string;
          first_name: string;
          last_name: string;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          auth_email: string;
          username: string;
          first_name: string;
          last_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_email?: string;
          username?: string;
          first_name?: string;
          last_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          code: string;
          logo_url: string;
          uefa_coefficient: number;
          disciplinary_points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          code: string;
          logo_url: string;
          uefa_coefficient?: number;
          disciplinary_points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          code?: string;
          logo_url?: string;
          uefa_coefficient?: number;
          disciplinary_points?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          name: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          team_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      matches: {
        Row: {
          id: string;
          matchday: number | null;
          stage: MatchStage;
          home_team_id: string;
          away_team_id: string;
          kickoff_at: string;
          status: MatchStatus;
          home_score: number | null;
          away_score: number | null;
          live_minute: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          matchday?: number | null;
          stage?: MatchStage;
          home_team_id: string;
          away_team_id: string;
          kickoff_at: string;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          live_minute?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          matchday?: number | null;
          stage?: MatchStage;
          home_team_id?: string;
          away_team_id?: string;
          kickoff_at?: string;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          live_minute?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_home_team_id_fkey";
            columns: ["home_team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_away_team_id_fkey";
            columns: ["away_team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          home_score: number;
          away_score: number;
          points_awarded: number | null;
          scoring_category: ScoringCategory | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          home_score: number;
          away_score: number;
          points_awarded?: number | null;
          scoring_category?: ScoringCategory | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: string;
          home_score?: number;
          away_score?: number;
          points_awarded?: number | null;
          scoring_category?: ScoringCategory | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      special_prediction_categories: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          target_type: SpecialTargetType;
          points_value: number;
          deadline_at: string;
          status: SpecialStatus;
          correct_team_id: string | null;
          correct_player_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          target_type: SpecialTargetType;
          points_value?: number;
          deadline_at: string;
          status?: SpecialStatus;
          correct_team_id?: string | null;
          correct_player_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          target_type?: SpecialTargetType;
          points_value?: number;
          deadline_at?: string;
          status?: SpecialStatus;
          correct_team_id?: string | null;
          correct_player_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      special_predictions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          selected_team_id: string | null;
          selected_player_id: string | null;
          points_awarded: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          selected_team_id?: string | null;
          selected_player_id?: string | null;
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          selected_team_id?: string | null;
          selected_player_id?: string | null;
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pickem_config: {
        Row: {
          id: string;
          season: string;
          deadline_at: string;
          status: SpecialStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          season?: string;
          deadline_at: string;
          status?: SpecialStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          season?: string;
          deadline_at?: string;
          status?: SpecialStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      pickem_submissions: {
        Row: {
          id: string;
          user_id: string;
          first_team_id: string;
          top8_team_ids: string[];
          out_team_ids: string[];
          points_awarded: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_team_id: string;
          top8_team_ids: string[];
          out_team_ids: string[];
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_team_id?: string;
          top8_team_ids?: string[];
          out_team_ids?: string[];
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          content?: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcement_comments: {
        Row: {
          id: string;
          announcement_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          announcement_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          announcement_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
