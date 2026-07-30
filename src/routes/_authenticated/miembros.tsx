import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Copy, Link2, Trash2, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({ meta: [{ title: "Miembros — HogarFin" }, { name: "description", content: "Gestión de miembros de tu familia." }] }),
  component: Miembros,
});

const ROLES = ["admin", "miembro", "invitado"] as const;

function Miembros() {
  const { role, user, familyId, familyName, refresh } = useAuth();
  const nav = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>("invitado");
  const [name, setName] = useState("");

  useEffect(() => {
    if (role !== null && role !== "admin") nav({ to: "/panel" });
  }, [role, nav]);

  useEffect(() => { setName(familyName ?? ""); }, [familyName]);

  async function load() {
    if (!familyId) return;
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from("family_members").select("*, profiles:user_id(id, name, email)").eq("family_id", familyId),
      supabase.from("invitations").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
    ]);
    setMembers(m ?? []);
    setInvites(inv ?? []);
  }
  useEffect(() => { load(); }, [familyId]);

  async function changeRole(memberId: string, newRole: string) {
    const { error } = await supabase.from("family_members").update({ role: newRole as any }).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    load();
    refresh();
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from("family_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Miembro removido de la familia");
    load();
  }

  async function renameFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    const { error } = await supabase.from("families").update({ name }).eq("id", familyId);
    if (error) return toast.error(error.message);
    toast.success("Nombre de la familia actualizado");
    refresh();
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/invitacion/${token}`;
  }

  async function createInvite() {
    if (!familyId || !user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({ created_by: user.id, family_id: familyId, role: inviteRole as any })
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
        <h1 className="text-2xl font-bold">Mi familia</h1>
        <p className="text-sm text-muted-foreground">Administra el nombre, los miembros y las invitaciones de tu hogar.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={renameFamily} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Nombre de la familia</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" variant="outline">Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[200px] flex-1">
              <div className="font-semibold">Invitar a tu familia</div>
              <p className="text-xs text-muted-foreground">
                Link de un solo uso, válido por 7 días. Quien lo abra se une <strong>solo a esta familia</strong>.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Rol</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createInvite} disabled={creating}>
                <Link2 className="mr-2 h-4 w-4" />
                {creating ? "Generando…" : "Generar link"}
              </Button>
            </div>
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
                        {state} · rol {i.role} · expira {formatDate(i.expires_at)}
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

      <div className="grid gap-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">{m.profiles?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)} disabled={m.user_id === user?.id}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}
                  </SelectContent>
                </Select>
                {m.user_id !== user?.id && (
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
