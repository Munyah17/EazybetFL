"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Wallet = Database["public"]["Tables"]["wallets"]["Row"];

type SessionContextValue = {
  userId: string | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  refreshWallet: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  userId: null,
  profile: null,
  wallet: null,
  loading: true,
  refreshWallet: async () => {},
  signOut: async () => {},
});

export function SessionProvider({
  children,
  initialProfile,
  initialWallet,
}: {
  children: React.ReactNode;
  initialProfile: Profile | null;
  initialWallet: Wallet | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [wallet, setWallet] = useState<Wallet | null>(initialWallet);
  const [loading, setLoading] = useState(false);

  const refreshWallet = async () => {
    if (!profile) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
    if (data) setWallet(data);
  };

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`wallet-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${profile.id}` },
        (payload) => setWallet(payload.new as Wallet)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setWallet(null);
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    router.push("/");
    router.refresh();
  };

  return (
    <SessionContext.Provider
      value={{ userId: profile?.id ?? null, profile, wallet, loading, refreshWallet, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
