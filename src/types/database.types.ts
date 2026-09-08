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
export type PickemCategory = "first" | "top8" | "out";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          first_name: string;
          last_name: string;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          announcements_last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          first_name: string;
          last_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          announcements_last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          first_name?: string;
          last_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          announcements_last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auth_mappings: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          auth_email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          auth_email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          auth_email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          code: string;
          logo_url: string | null;
          uefa_coefficient: number;
          disciplinary_points: number;
          goal_api_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          code: string;
          logo_url?: string | null;
          uefa_coefficient?: number;
          disciplinary_points?: number;
          goal_api_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          code?: string;
          logo_url?: string | null;
          uefa_coefficient?: number;
          disciplinary_points?: number;
          goal_api_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          name: string;
          team_id: string;
          is_active: boolean;
          is_ucl_registered: boolean;
          uefa_player_id: string | null;
          uefa_list_type: "A" | "B" | null;
          goal_api_player_id: string | null;
          goal_api_player_api_id: string | null;
          position: string | null;
          jersey_number: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          team_id: string;
          is_active?: boolean;
          is_ucl_registered?: boolean;
          uefa_player_id?: string | null;
          uefa_list_type?: "A" | "B" | null;
          goal_api_player_id?: string | null;
          goal_api_player_api_id?: string | null;
          position?: string | null;
          jersey_number?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          team_id?: string;
          is_active?: boolean;
          is_ucl_registered?: boolean;
          uefa_player_id?: string | null;
          uefa_list_type?: "A" | "B" | null;
          goal_api_player_id?: string | null;
          goal_api_player_api_id?: string | null;
          position?: string | null;
          jersey_number?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
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
          is_betting_locked: boolean;
          betting_locked_at: string | null;
          status: MatchStatus;
          home_score: number | null;
          away_score: number | null;
          winner_team_id: string | null;
          events_reconciled_at: string | null;
          live_minute: number | null;
          goal_api_fixture_id: string | null;
          is_manual_override: boolean;
          last_synced_at: string | null;
          points_multiplier: number;
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
          is_betting_locked?: boolean;
          betting_locked_at?: string | null;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          winner_team_id?: string | null;
          events_reconciled_at?: string | null;
          live_minute?: number | null;
          goal_api_fixture_id?: string | null;
          is_manual_override?: boolean;
          last_synced_at?: string | null;
          points_multiplier?: number;
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
          is_betting_locked?: boolean;
          betting_locked_at?: string | null;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          winner_team_id?: string | null;
          events_reconciled_at?: string | null;
          live_minute?: number | null;
          goal_api_fixture_id?: string | null;
          is_manual_override?: boolean;
          last_synced_at?: string | null;
          points_multiplier?: number;
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
          is_locked: boolean;
          locked_at: string | null;
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
          is_locked?: boolean;
          locked_at?: string | null;
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
          is_locked?: boolean;
          locked_at?: string | null;
          correct_team_id?: string | null;
          correct_player_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      special_prediction_correct_answers: {
        Row: {
          id: string;
          category_id: string;
          team_id: string | null;
          player_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          team_id?: string | null;
          player_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          team_id?: string | null;
          player_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "special_prediction_correct_answers_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "special_prediction_categories";
            referencedColumns: ["id"];
          }
        ];
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
          is_locked: boolean;
          locked_at: string | null;
          points_multiplier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          season?: string;
          deadline_at: string;
          status?: SpecialStatus;
          is_locked?: boolean;
          locked_at?: string | null;
          points_multiplier?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          season?: string;
          deadline_at?: string;
          status?: SpecialStatus;
          is_locked?: boolean;
          locked_at?: string | null;
          points_multiplier?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value_int: number | null;
          value_text: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value_int?: number | null;
          value_text?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value_int?: number | null;
          value_text?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pickem_submissions: {
        Row: {
          id: string;
          user_id: string;
          config_id: string;
          first_team_id: string | null;
          top8_team_ids: string[] | null;
          out_team_ids: string[] | null;
          points_awarded: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          config_id: string;
          first_team_id?: string | null;
          top8_team_ids?: string[] | null;
          out_team_ids?: string[] | null;
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          config_id?: string;
          first_team_id?: string | null;
          top8_team_ids?: string[] | null;
          out_team_ids?: string[] | null;
          points_awarded?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pickem_selections: {
        Row: {
          id: string;
          submission_id: string;
          team_id: string;
          category: PickemCategory;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          team_id: string;
          category: PickemCategory;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          team_id?: string;
          category?: PickemCategory;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pickem_selections_submission_id_fkey";
            columns: ["submission_id"];
            referencedRelation: "pickem_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pickem_selections_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      announcements: {
        Row: {
          id: string;
          author_id: string | null;
          title: string;
          content: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string | null;
          title: string;
          content: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string | null;
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
          user_id: string | null;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          announcement_id: string;
          user_id?: string | null;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          announcement_id?: string;
          user_id?: string | null;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comment_rate_limits: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
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
      login_attempts: {
        Row: {
          id: string;
          ip_address: string | null;
          username: string | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          ip_address?: string | null;
          username?: string | null;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          ip_address?: string | null;
          username?: string | null;
          attempted_at?: string;
        };
        Relationships: [];
      };
      match_events: {
        Row: {
          id: string;
          match_id: string;
          goal_api_event_id: string;
          event_type: string;
          minute: number | null;
          team_id: string | null;
          side: string | null;
          scorer_external_id: string | null;
          scorer_name: string | null;
          assist_external_id: string | null;
          assist_name: string | null;
          info: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          goal_api_event_id: string;
          event_type: string;
          minute?: number | null;
          team_id?: string | null;
          side?: string | null;
          scorer_external_id?: string | null;
          scorer_name?: string | null;
          assist_external_id?: string | null;
          assist_name?: string | null;
          info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          goal_api_event_id?: string;
          event_type?: string;
          minute?: number | null;
          team_id?: string | null;
          side?: string | null;
          scorer_external_id?: string | null;
          scorer_name?: string | null;
          assist_external_id?: string | null;
          assist_name?: string | null;
          info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_events_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      external_api_sync_state: {
        Row: {
          provider: string;
          quota_limit: number | null;
          quota_remaining: number | null;
          quota_reset_at: string | null;
          last_request_at: string | null;
          last_success_at: string | null;
          last_error: string | null;
          updated_at: string;
        };
        Insert: {
          provider: string;
          quota_limit?: number | null;
          quota_remaining?: number | null;
          quota_reset_at?: string | null;
          last_request_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Update: {
          provider?: string;
          quota_limit?: number | null;
          quota_remaining?: number | null;
          quota_reset_at?: string | null;
          last_request_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_leases: {
        Row: {
          sync_name: string;
          locked_until: string;
          locked_by: string;
          last_started_at: string;
          last_finished_at: string | null;
          status: string;
        };
        Insert: {
          sync_name: string;
          locked_until: string;
          locked_by: string;
          last_started_at: string;
          last_finished_at?: string | null;
          status?: string;
        };
        Update: {
          sync_name?: string;
          locked_until?: string;
          locked_by?: string;
          last_started_at?: string;
          last_finished_at?: string | null;
          status?: string;
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
      is_active_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      acquire_sync_lease: {
        Args: {
          p_sync_name: string;
          p_locked_by: string;
          p_duration_seconds?: number;
        };
        Returns: boolean;
      };
      release_sync_lease: {
        Args: {
          p_sync_name: string;
          p_locked_by: string;
          p_status?: string;
        };
        Returns: void;
      };
      get_ucl_scorers_and_assists: {
        Args: Record<PropertyKey, never>;
        Returns: {
          player_name: string;
          scorer_external_id: string | null;
          team_id: string | null;
          team_name: string | null;
          team_code: string | null;
          team_logo_url: string | null;
          goals_count: number;
          assists_count: number;
        }[];
      };
      check_and_record_login_attempt: {
        Args: {
          p_ip: string;
          p_username: string;
          p_max_attempts?: number;
          p_window_seconds?: number;
        };
        Returns: {
          is_allowed: boolean;
          remaining_seconds: number;
        }[];
      };
      finalize_and_score_match: {
        Args: {
          p_match_id: string;
          p_home_score: number;
          p_away_score: number;
        };
        Returns: void;
      };
      settle_special_prediction_category: {
        Args: {
          p_category_id: string;
          p_correct_team_ids: string[];
          p_correct_player_ids: string[];
        };
        Returns: void;
      };
      settle_pickem: {
        Args: {
          p_final_standings: string[];
        };
        Returns: void;
      };
      correct_legacy_pickem_submission: {
        Args: {
          p_additional_out_team_ids: string[];
        };
        Returns: {
          success: boolean;
          submissionId: string;
          outCount: number;
          middleCount: number;
        };
      };
      check_and_record_comment_attempt: {
        Args: {
          p_user_id: string;
          p_max_attempts?: number;
          p_window_seconds?: number;
        };
        Returns: {
          is_allowed: boolean;
          remaining_seconds: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
