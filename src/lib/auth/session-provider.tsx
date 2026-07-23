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
  openBetsCount: number;
  loading: boolean;
  refreshWallet: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  userId: null,
  profile: null,
  wallet: null,
  openBetsCount: 0,
  loading: true,
  refreshWallet: async () => {},
  signOut: async () => {},
});

export function SessionProvider({
  children,
  initialProfile,
  initialWallet,
  initialOpenBetsCount,
}: {
  children: React.ReactNode;
  initialProfile: Profile | null;
  initialWallet: Wallet | null;
  initialOpenBetsCount: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [wallet, setWallet] = useState<Wallet | null>(initialWallet);
  const [openBetsCount, setOpenBetsCount] = useState(initialOpenBetsCount);
  const [loading, setLoading] = useState(false);

  const refreshWallet = async () => {
    if (!profile) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
    if (data) setWallet(data);
  };

  const refreshOpenBetsCount = async () => {
    if (!profile) return;
    const { count } = await supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "open");
    setOpenBetsCount(count ?? 0);
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

    const betsChannel = supabase
      .channel(`bets-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${profile.id}` },
        () => refreshOpenBetsCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(betsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setWallet(null);
        setOpenBetsCount(0);
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
      value={{
        userId: profile?.id ?? null,
        profile,
        wallet,
        openBetsCount,
        loading,
        refreshWallet,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
