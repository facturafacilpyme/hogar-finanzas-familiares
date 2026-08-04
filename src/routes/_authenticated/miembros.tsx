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
import { useServerFn } from "@tanstack/react-start";
import { purgeFamilyMember } from "@/lib/admin.functions";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useConfirm } from "@/components/ConfirmDialog";

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
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [phones, setPhones] = useState<Record<string, string>>({});
  const purge = useServerFn(purgeFamilyMember);
  const confirmar = useConfirm();

  useEffect(() => {
    if (role !== null && role !== "admin") nav({ to: "/panel" });
  }, [role, nav]);

  useEffect(() => { setName(familyName ?? ""); }, [familyName]);

  async function load() {
    if (!familyId) return;
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from("family_members").select("*").eq("family_id", familyId).order("created_at"),
      supabase.from("invitations").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
    ]);
    const ids = (m ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, email, phone").in("id", ids)
      : { data: [] as any[] };
    setMembers((m ?? []).map((x: any) => ({ ...x, profiles: (profs ?? []).find((p: any) => p.id === x.user_id) ?? null })));
    const ph: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => { ph[p.id] = p.phone ?? ""; });
    setPhones(ph);
    setInvites(inv ?? []);
  }
  useEffect(() => { load(); }, [familyId]);

  async function savePhone(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ phone: (phones[userId] ?? "").trim() || null })
      .eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("WhatsApp actualizado");
    load();
    refresh();
  }

  async function changeRole(memberId: string, newRole: string) {
    const { error } = await supabase.from("family_members").update({ role: newRole as any }).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    load();
    refresh();
  }

  async function removeMember(m: any) {
    if (!familyId) return;
    if (!confirm(`¿Eliminar a ${m.profiles?.name ?? "este miembro"} de la familia? Su cuenta se borra por completo y podrá registrarse de nuevo.`)) return;
    try {
      await purge({ data: { familyId, userId: m.user_id } });
      toast.success("Miembro eliminado por completo");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo eliminar");
    }
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
      .insert({
        created_by: user.id,
        family_id: familyId,
        role: inviteRole as any,
        email: invEmail.trim().toLowerCase() || null,
        name: invName.trim() || null,
      })
      .select()
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    await navigator.clipboard.writeText(inviteUrl(data.token)).catch(() => {});
    toast.success("Link creado y copiado al portapapeles");
    setInvName("");
    setInvEmail("");
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
          <div>
            <div className="font-semibold">Invitar a tu familia</div>
            <p className="text-xs text-muted-foreground">
              Escribe el nombre y el correo de la persona: al abrir el link solo tendrá que crear su contraseña y
              entrará directo a <strong>esta familia</strong> con el rol que elijas. Si dejas el correo vacío, se genera
              un link abierto. Un solo uso, válido 7 días.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Ana Pérez" />
            </div>
            <div>
              <Label className="text-xs">Correo (opcional)</Label>
              <Input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} type="email" placeholder="ana@correo.com" />
            </div>
            <div>
              <Label className="text-xs">Rol</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={createInvite} disabled={creating}>
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
                      <div className="break-all font-mono text-[11px]">{inviteUrl(i.token)}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.name ? `${i.name} · ` : ""}{i.email ? `${i.email} · ` : ""}{state} · rol {i.role} · expira {formatDate(i.expires_at)}
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Miembros ({members.length})</h2>
      </div>
      <div className="grid gap-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <Label className="text-xs">WhatsApp</Label>
                  <Input
                    value={phones[m.user_id] ?? ""}
                    onChange={(e) => setPhones((s) => ({ ...s, [m.user_id]: e.target.value }))}
                    placeholder="3001234567"
                    inputMode="tel"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => savePhone(m.user_id)}>Guardar</Button>
                <WhatsAppButton
                  phone={phones[m.user_id]}
                  label="Saludar"
                  message={`Hola ${m.profiles?.name ?? ""} 👋 Te escribo desde HogarFin (${familyName ?? "nuestra familia"}). Aquí llevamos juntos las deudas y las metas de ahorro del hogar.`}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
