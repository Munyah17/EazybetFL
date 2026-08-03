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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          accent: Database["public"]["Enums"]["banner_accent"]
          active: boolean
          created_at: string
          created_by: string | null
          cta_href: string | null
          cta_label: string | null
          description: string | null
          display_order: number
          ends_at: string | null
          eyebrow: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["banner_kind"]
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent?: Database["public"]["Enums"]["banner_accent"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["banner_kind"]
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent?: Database["public"]["Enums"]["banner_accent"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["banner_kind"]
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_selections: {
        Row: {
          bet_id: string
          fixture_id: string
          fixture_label: string
          id: string
          market_id: string
          market_name: string
          odds_price: number
          outcome_id: string
          selection_name: string
          settled_at: string | null
          status: Database["public"]["Enums"]["selection_status"]
        }
        Insert: {
          bet_id: string
          fixture_id: string
          fixture_label: string
          id?: string
          market_id: string
          market_name: string
          odds_price: number
          outcome_id: string
          selection_name: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["selection_status"]
        }
        Update: {
          bet_id?: string
          fixture_id?: string
          fixture_label?: string
          id?: string
          market_id?: string
          market_name?: string
          odds_price?: number
          outcome_id?: string
          selection_name?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["selection_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "odds_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          base_total_odds: number
          bet_type: Database["public"]["Enums"]["bet_type"]
          cash_out_value: number | null
          cashed_out_at: string | null
          id: string
          is_free_bet: boolean
          placed_at: string
          placement_group_id: string
          potential_payout: number
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          system_size: number | null
          total_odds: number
          user_id: string
          wallet_id: string
          winboost_enabled: boolean
          winboost_pct: number
        }
        Insert: {
          base_total_odds: number
          bet_type: Database["public"]["Enums"]["bet_type"]
          cash_out_value?: number | null
          cashed_out_at?: string | null
          id?: string
          is_free_bet?: boolean
          placed_at?: string
          placement_group_id?: string
          potential_payout: number
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          system_size?: number | null
          total_odds: number
          user_id: string
          wallet_id: string
          winboost_enabled?: boolean
          winboost_pct?: number
        }
        Update: {
          base_total_odds?: number
          bet_type?: Database["public"]["Enums"]["bet_type"]
          cash_out_value?: number | null
          cashed_out_at?: string | null
          id?: string
          is_free_bet?: boolean
          placed_at?: string
          placement_group_id?: string
          potential_payout?: number
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          system_size?: number | null
          total_odds?: number
          user_id?: string
          wallet_id?: string
          winboost_enabled?: boolean
          winboost_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      booked_bets: {
        Row: {
          bet_code: string
          bet_type: Database["public"]["Enums"]["bet_type"]
          created_at: string
          expires_at: string
          id: string
          load_count: number
          loaded_at: string | null
          selections: Json
          status: Database["public"]["Enums"]["booked_bet_status"]
          total_odds: number
          user_id: string | null
        }
        Insert: {
          bet_code: string
          bet_type: Database["public"]["Enums"]["bet_type"]
          created_at?: string
          expires_at: string
          id?: string
          load_count?: number
          loaded_at?: string | null
          selections: Json
          status?: Database["public"]["Enums"]["booked_bet_status"]
          total_odds: number
          user_id?: string | null
        }
        Update: {
          bet_code?: string
          bet_type?: Database["public"]["Enums"]["bet_type"]
          created_at?: string
          expires_at?: string
          id?: string
          load_count?: number
          loaded_at?: string | null
          selections?: Json
          status?: Database["public"]["Enums"]["booked_bet_status"]
          total_odds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booked_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          id: string
          odds_api_key: string
          region: string | null
          sport_group_id: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          odds_api_key: string
          region?: string | null
          sport_group_id: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          odds_api_key?: string
          region?: string | null
          sport_group_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_sport_group_id_fkey"
            columns: ["sport_group_id"]
            isOneToOne: false
            referencedRelation: "sport_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          client_correlator: string | null
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paynow_poll_url: string | null
          paynow_reference: string | null
          phone_number: string | null
          provider: string
          provider_payload: Json | null
          provider_transaction_id: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          client_correlator?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paynow_poll_url?: string | null
          paynow_reference?: string | null
          phone_number?: string | null
          provider?: string
          provider_payload?: Json | null
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          client_correlator?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paynow_poll_url?: string | null
          paynow_reference?: string | null
          phone_number?: string | null
          provider?: string
          provider_payload?: Json | null
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_team: string
          commence_time: string
          competition_id: string
          created_at: string
          extra_markets_synced_at: string | null
          home_score: number | null
          home_team: string
          id: string
          is_featured: boolean
          last_synced_at: string | null
          minute: number | null
          odds_api_event_id: string | null
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          commence_time: string
          competition_id: string
          created_at?: string
          extra_markets_synced_at?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          is_featured?: boolean
          last_synced_at?: string | null
          minute?: number | null
          odds_api_event_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          commence_time?: string
          competition_id?: string
          created_at?: string
          extra_markets_synced_at?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          is_featured?: boolean
          last_synced_at?: string | null
          minute?: number | null
          odds_api_event_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          created_at: string
          display_order: number
          fixture_id: string
          id: string
          market_key: string
          market_name: string
          status: Database["public"]["Enums"]["market_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          fixture_id: string
          id?: string
          market_key: string
          market_name: string
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          fixture_id?: string
          id?: string
          market_key?: string
          market_name?: string
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_outcomes: {
        Row: {
          bookmaker: string
          display_order: number
          id: string
          market_id: string
          name: string
          point: number | null
          price: number
          updated_at: string
        }
        Insert: {
          bookmaker?: string
          display_order?: number
          id?: string
          market_id: string
          name: string
          point?: number | null
          price: number
          updated_at?: string
        }
        Update: {
          bookmaker?: string
          display_order?: number
          id?: string
          market_id?: string
          name?: string
          point?: number | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_outcomes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_number: string
          assigned_agent_id: string | null
          avatar_url: string | null
          commission_rate: number
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          last_login_at: string | null
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_number: string
          assigned_agent_id?: string | null
          avatar_url?: string | null
          commission_rate?: number
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_number?: string
          assigned_agent_id?: string | null
          avatar_url?: string | null
          commission_rate?: number
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          banner_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          min_odds: number | null
          min_selections: number | null
          starts_at: string
          terms: string | null
          title: string
          type: Database["public"]["Enums"]["promo_type"]
          value: number | null
          wagering_requirement: number | null
        }
        Insert: {
          active?: boolean
          banner_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          min_odds?: number | null
          min_selections?: number | null
          starts_at?: string
          terms?: string | null
          title: string
          type: Database["public"]["Enums"]["promo_type"]
          value?: number | null
          wagering_requirement?: number | null
        }
        Update: {
          active?: boolean
          banner_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          min_odds?: number | null
          min_selections?: number | null
          starts_at?: string
          terms?: string | null
          title?: string
          type?: Database["public"]["Enums"]["promo_type"]
          value?: number | null
          wagering_requirement?: number | null
        }
        Relationships: []
      }
      sport_groups: {
        Row: {
          active: boolean
          display_order: number
          icon: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          active?: boolean
          display_order?: number
          icon?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          active?: boolean
          display_order?: number
          icon?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      user_bonuses: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          promotion_id: string | null
          status: Database["public"]["Enums"]["bonus_status"]
          user_id: string
          wagering_progress: number
          wagering_required: number
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          promotion_id?: string | null
          status?: Database["public"]["Enums"]["bonus_status"]
          user_id: string
          wagering_progress?: number
          wagering_required?: number
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          promotion_id?: string | null
          status?: Database["public"]["Enums"]["bonus_status"]
          user_id?: string
          wagering_progress?: number
          wagering_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_bonuses_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bonuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          amount: number
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: Database["public"]["Enums"]["voucher_status"]
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          bucket: Database["public"]["Enums"]["wallet_bucket"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          bucket?: Database["public"]["Enums"]["wallet_bucket"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          bucket?: Database["public"]["Enums"]["wallet_bucket"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          bonus_balance: number
          created_at: string
          currency: string
          id: string
          locked_balance: number
          principal_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_balance?: number
          created_at?: string
          currency?: string
          id?: string
          locked_balance?: number
          principal_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_balance?: number
          created_at?: string
          currency?: string
          id?: string
          locked_balance?: number
          principal_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          completed_at: string | null
          currency: string
          destination: Json
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          provider_reference: string | null
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          currency?: string
          destination: Json
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          provider_reference?: string | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          currency?: string
          destination?: Json
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          provider_reference?: string | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_staff_member: {
        Args: {
          p_department?: string
          p_email: string
          p_first_name: string
          p_gender?: string
          p_last_name: string
          p_password: string
          p_role: string
          p_staff_title?: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      fn_agent_deposit_customer: {
        Args: { p_amount: number; p_customer_id: string }
        Returns: undefined
      }
      fn_agent_withdraw_customer: {
        Args: { p_amount: number; p_customer_id: string }
        Returns: undefined
      }
      fn_approve_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: undefined
      }
      fn_book_bet: {
        Args: {
          p_bet_type: Database["public"]["Enums"]["bet_type"]
          p_selections: Json
        }
        Returns: Json
      }
      fn_cash_out: { Args: { p_bet_id: string }; Returns: Json }
      fn_cash_out_preview: { Args: { p_bet_id: string }; Returns: Json }
      fn_choose: { Args: { k: number; n: number }; Returns: number }
      fn_complete_deposit: {
        Args: { p_deposit_id: string }
        Returns: undefined
      }
      fn_expire_booked_bets: { Args: never; Returns: number }
      fn_fail_deposit: { Args: { p_deposit_id: string }; Returns: undefined }
      fn_generate_vouchers: {
        Args: { p_amount: number; p_count?: number; p_expires_at?: string }
        Returns: {
          amount: number
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: Database["public"]["Enums"]["voucher_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "vouchers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_gift_voucher: {
        Args: { p_amount: number; p_recipient_account_number: string }
        Returns: Json
      }
      fn_link_agent: { Args: { p_agent_code: string }; Returns: undefined }
      fn_load_booked_bet: { Args: { p_bet_code: string }; Returns: Json }
      fn_lookup_email_by_phone: { Args: { p_phone: string }; Returns: string }
      fn_lookup_user_by_account_number: {
        Args: { p_account_number: string }
        Returns: Json
      }
      fn_place_bet: {
        Args: {
          p_bet_type: Database["public"]["Enums"]["bet_type"]
          p_selections: Json
          p_stake: number
          p_system_size?: number
          p_winboost?: boolean
        }
        Returns: Json
      }
      fn_redeem_voucher: { Args: { p_code: string }; Returns: Json }
      fn_reject_withdrawal: {
        Args: { p_reason: string; p_withdrawal_id: string }
        Returns: undefined
      }
      fn_request_withdrawal: {
        Args: {
          p_amount: number
          p_destination: Json
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      fn_settle_bet: { Args: { p_bet_id: string }; Returns: Json }
      fn_settle_selection: {
        Args: {
          p_selection_id: string
          p_status: Database["public"]["Enums"]["selection_status"]
        }
        Returns: undefined
      }
      fn_share_profit: {
        Args: {
          p_amount: number
          p_note?: string
          p_recipient_account_number: string
        }
        Returns: Json
      }
      fn_void_voucher: { Args: { p_voucher_id: string }; Returns: undefined }
      fn_wallet_credit:
        | {
            Args: {
              p_amount: number
              p_created_by?: string
              p_description: string
              p_reference_id: string
              p_reference_type: string
              p_status?: Database["public"]["Enums"]["wallet_tx_status"]
              p_type: Database["public"]["Enums"]["wallet_tx_type"]
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_bucket?: Database["public"]["Enums"]["wallet_bucket"]
              p_created_by?: string
              p_description: string
              p_reference_id: string
              p_reference_type: string
              p_status?: Database["public"]["Enums"]["wallet_tx_status"]
              p_type: Database["public"]["Enums"]["wallet_tx_type"]
              p_user_id: string
            }
            Returns: string
          }
      fn_wallet_debit:
        | {
            Args: {
              p_amount: number
              p_created_by?: string
              p_description: string
              p_reference_id: string
              p_reference_type: string
              p_status?: Database["public"]["Enums"]["wallet_tx_status"]
              p_type: Database["public"]["Enums"]["wallet_tx_type"]
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_bucket?: Database["public"]["Enums"]["wallet_bucket"]
              p_created_by?: string
              p_description: string
              p_reference_id: string
              p_reference_type: string
              p_status?: Database["public"]["Enums"]["wallet_tx_status"]
              p_type: Database["public"]["Enums"]["wallet_tx_type"]
              p_user_id: string
            }
            Returns: string
          }
      fn_wallet_debit_spend: {
        Args: {
          p_amount: number
          p_description: string
          p_reference_id: string
          p_reference_type: string
          p_type: Database["public"]["Enums"]["wallet_tx_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      fn_write_audit_log: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: undefined
      }
      generate_account_number: { Args: never; Returns: string }
      generate_bet_code: { Args: never; Returns: string }
      generate_voucher_code: { Args: never; Returns: string }
      get_my_school_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_agent: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      banner_accent: "primary" | "boost" | "info"
      banner_kind: "hero_slide" | "announcement"
      bet_status:
        | "open"
        | "won"
        | "lost"
        | "void"
        | "cashed_out"
        | "partially_cashed_out"
      bet_type: "single" | "multiple" | "system"
      bonus_status: "active" | "completed" | "expired" | "forfeited"
      booked_bet_status: "active" | "loaded" | "expired" | "cancelled"
      deposit_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      fixture_status:
        | "upcoming"
        | "live"
        | "finished"
        | "cancelled"
        | "postponed"
      market_status: "open" | "suspended" | "closed"
      notification_type:
        | "bet_won"
        | "bet_lost"
        | "bet_settled"
        | "deposit"
        | "withdrawal"
        | "bonus"
        | "promo"
        | "system"
      payment_method:
        | "ecocash"
        | "onemoney"
        | "innbucks"
        | "omari"
        | "mukuru"
        | "visa"
        | "mastercard"
        | "bank_transfer"
      promo_type:
        | "welcome_bonus"
        | "deposit_bonus"
        | "free_bet"
        | "odds_boost"
        | "cashback"
      selection_status: "pending" | "won" | "lost" | "void"
      user_role: "user" | "admin" | "super_admin" | "agent"
      voucher_status: "active" | "redeemed" | "void"
      wallet_bucket: "principal" | "balance"
      wallet_tx_status: "pending" | "completed" | "failed" | "reversed"
      wallet_tx_type:
        | "deposit"
        | "withdrawal"
        | "bet_stake"
        | "bet_payout"
        | "bet_refund"
        | "bonus_credit"
        | "bonus_debit"
        | "cashout"
        | "adjustment"
        | "booking_release"
        | "agent_deposit"
        | "agent_withdrawal"
        | "commission"
        | "voucher_redemption"
        | "voucher_gift"
        | "profit_share_sent"
        | "profit_share_received"
      withdrawal_status:
        | "pending"
        | "approved"
        | "processing"
        | "completed"
        | "rejected"
        | "failed"
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
      account_status: ["active", "suspended", "banned"],
      banner_accent: ["primary", "boost", "info"],
      banner_kind: ["hero_slide", "announcement"],
      bet_status: [
        "open",
        "won",
        "lost",
        "void",
        "cashed_out",
        "partially_cashed_out",
      ],
      bet_type: ["single", "multiple", "system"],
      bonus_status: ["active", "completed", "expired", "forfeited"],
      booked_bet_status: ["active", "loaded", "expired", "cancelled"],
      deposit_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      fixture_status: [
        "upcoming",
        "live",
        "finished",
        "cancelled",
        "postponed",
      ],
      market_status: ["open", "suspended", "closed"],
      notification_type: [
        "bet_won",
        "bet_lost",
        "bet_settled",
        "deposit",
        "withdrawal",
        "bonus",
        "promo",
        "system",
      ],
      payment_method: [
        "ecocash",
        "onemoney",
        "innbucks",
        "omari",
        "mukuru",
        "visa",
        "mastercard",
        "bank_transfer",
      ],
      promo_type: [
        "welcome_bonus",
        "deposit_bonus",
        "free_bet",
        "odds_boost",
        "cashback",
      ],
      selection_status: ["pending", "won", "lost", "void"],
      user_role: ["user", "admin", "super_admin", "agent"],
      voucher_status: ["active", "redeemed", "void"],
      wallet_bucket: ["principal", "balance"],
      wallet_tx_status: ["pending", "completed", "failed", "reversed"],
      wallet_tx_type: [
        "deposit",
        "withdrawal",
        "bet_stake",
        "bet_payout",
        "bet_refund",
        "bonus_credit",
        "bonus_debit",
        "cashout",
        "adjustment",
        "booking_release",
        "agent_deposit",
        "agent_withdrawal",
        "commission",
        "voucher_redemption",
        "voucher_gift",
        "profit_share_sent",
        "profit_share_received",
      ],
      withdrawal_status: [
        "pending",
        "approved",
        "processing",
        "completed",
        "rejected",
        "failed",
      ],
    },
  },
} as const
