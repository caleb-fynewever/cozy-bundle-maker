import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  session: Session | null;
  loading: boolean;
};

/** Tracks the signed-in session. Starts loading until the first auth event. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    restoreSessionFromUrl()
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

let urlRestore: Promise<void> | null = null;
/** After full-page Google sign-in, set the session from URL tokens before any auth gate runs. */
function restoreSessionFromUrl(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (urlRestore) return urlRestore;
  urlRestore = (async () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const access_token = hash.get("access_token") ?? query.get("access_token");
    const refresh_token = hash.get("refresh_token") ?? query.get("refresh_token");
    const code = query.get("code");
    try {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else if (code) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) await supabase.auth.exchangeCodeForSession(code);
      } else {
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* fall through to normal session check */
    }
  })();
  return urlRestore;
}
