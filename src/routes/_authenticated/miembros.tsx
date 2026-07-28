import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({ meta: [{ title: "Miembros — HogarFin" }, { name: "description", content: "Gestión de miembros de la familia." }] }),
  component: Miembros,
});

const ROLES = ["admin", "miembro", "invitado"] as const;

function Miembros() {
  const { role } = useAuth();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    if (role !== null && role !== "admin") nav({ to: "/panel" });
  }, [role, nav]);

  async function load() {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("user_roles").select("*"),
    ]);
    setProfiles(p ?? []);
    setRoles(r ?? []);
  }
  useEffect(() => { load(); }, []);

  async function changeRole(userId: string, newRole: string) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    load();
  }

  if (role !== "admin") return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Miembros</h1>
        <p className="text-sm text-muted-foreground">Administra roles del hogar.</p>
      </div>

      {profiles.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin miembros aún.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {profiles.map((p) => {
            const r = roles.find((x) => x.user_id === p.id)?.role ?? "invitado";
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                  </div>
                  <Select value={r} onValueChange={(v) => changeRole(p.id, v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// suppress unused import
void Button;