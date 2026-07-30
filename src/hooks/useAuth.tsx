import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "miembro" | "invitado";

interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface Membership {
  family_id: string;
  family_name: string;
  role: Role;
}

const STORAGE_KEY = "hogarfin_family_id";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  memberships: Membership[];
  familyId: string | null;
  familyName: string | null;
  setFamilyId: (id: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [familyId, setFamilyIdState] = useState<string | null>(null);

  function setFamilyId(id: string) {
    setFamilyIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  async function loadRoleProfile(uid: string) {
    const [{ data: p }, { data: fm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("family_members")
        .select("family_id, role, families(name)")
        .eq("user_id", uid)
        .order("created_at"),
    ]);
    setProfile((p as Profile | null) ?? null);
    const list: Membership[] = (fm ?? []).map((m: any) => ({
      family_id: m.family_id,
      family_name: m.families?.name ?? "Mi familia",
      role: m.role as Role,
    }));
    setMemberships(list);

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}
    const valid = list.find((m) => m.family_id === stored) ?? list[0] ?? null;
    setFamilyIdState(valid?.family_id ?? null);
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) await loadRoleProfile(data.session.user.id);
    else {
      setProfile(null);
      setMemberships([]);
      setFamilyIdState(null);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadRoleProfile(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setMemberships([]);
        setFamilyIdState(null);
      }
    });
    refresh().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    await supabase.auth.signOut();
  }

  const current = memberships.find((m) => m.family_id === familyId) ?? null;

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        role: current?.role ?? null,
        loading,
        memberships,
        familyId,
        familyName: current?.family_name ?? null,
        setFamilyId,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return c;
}