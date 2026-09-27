import type { Database, Json } from "@/integrations/supabase/types";
type Table<R, I = Partial<R>> = { Row: R; Insert: I; Update: Partial<I>; Relationships: [] };
export type DirectoryPerson = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  xp: number;
  week_xp: number;
  completed: number;
  created: number;
  weekly_streak: number;
};
export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      student_verifications: Table<{ user_id: string; email: string; verified_at: string }>;
      xp_events: Table<{
        user_id: string;
        kind: "complete" | "squad" | "create" | "join" | "verify";
        ref_id: string;
        xp: number;
        label: string;
        awarded_at: string;
        active: boolean;
      }>;
      quests: Table<
        {
          id: string;
          owner_id: string | null;
          archived: boolean;
          content: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          owner_id?: string | null;
          archived?: boolean;
          content: Json;
          updated_at?: string;
        }
      >;
      demo_squads: Table<{ id: string; name: string; leader_id: string }>;
      demo_squad_members: Table<{ squad_id: string; person_id: string }>;
      demo_people: Table<{ id: string; handle: string; name: string; data: Json }>;
      squad_demo_members: Table<
        { squad_id: string; person_id: string },
        { squad_id: string; person_id: string }
      >;
      account_state: Table<{
        user_id: string;
        revision: number;
        payload: Json;
        updated_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      read_feed: { Args: Record<string, never>; Returns: Json };
      sync_social: { Args: { posts: Json; heart_ids: Json; comments: Json }; Returns: Json };
      take_verification_attempt: { Args: { person: string; checking: boolean }; Returns: boolean };
      publish_quest: { Args: { quest_content: Json }; Returns: undefined };
      people_directory: { Args: Record<string, never>; Returns: DirectoryPerson[] };
      save_account_state: {
        Args: { expected_revision: number; new_payload: Json };
        Returns: number;
      };
    };
  };
};
