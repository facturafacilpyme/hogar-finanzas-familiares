import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Copy, Link2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/currency";

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
  const [invites, setInvites] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (role !== null && role !== "admin") nav({ to: "/panel" });
  }, [role, nav]);

  async function load() {
    const [{ data: p }, { data: r }, { data: inv }] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("user_roles").select("*"),
      supabase.from("invitations").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles(p ?? []);
    setRoles(r ?? []);
    setInvites(inv ?? []);
  }
  useEffect(() => { load(); }, []);

  async function changeRole(userId: string, newRole: string) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    load();
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/invitacion/${token}`;
  }

  async function createInvite() {
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setCreating(false); return; }
    const { data, error } = await supabase
      .from("invitations")
      .insert({ created_by: u.user.id, role: "invitado" as any })
      .select()
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    await navigator.clipboard.writeText(inviteUrl(data.token)).catch(() => {});
    toast.success("Link creado y copiado al portapapeles");
    load();
  }

  async function copyInvite(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    toast.success("Link copiado");
  }

  async function removeInvite(id: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invitación eliminada");
    load();
  }

  if (role !== "admin") return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Miembros</h1>
        <p className="text-sm text-muted-foreground">Administra roles del hogar.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Invitar como Invitado (solo lectura)</div>
              <p className="text-xs text-muted-foreground">
                Genera un link de un solo uso, válido por 7 días. Quien lo abra y cree su cuenta entrará como Invitado.
              </p>
            </div>
            <Button onClick={createInvite} disabled={creating}>
              <Link2 className="mr-2 h-4 w-4" />
              {creating ? "Generando…" : "Generar link"}
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2">
              {invites.map((i) => {
                const used = !!i.accepted_at;
                const expired = new Date(i.expires_at) < new Date();
                const state = used ? "Usada" : expired ? "Expirada" : "Activa";
                return (
                  <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs">{inviteUrl(i.token)}</div>
                      <div className="text-xs text-muted-foreground">
                        {state} · expira {formatDate(i.expires_at)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!used && !expired && (
                        <Button size="sm" variant="outline" onClick={() => copyInvite(i.token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeInvite(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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