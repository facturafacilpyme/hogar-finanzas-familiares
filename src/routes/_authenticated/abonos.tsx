import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Search, Pencil, Trash2 } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { ProofLink } from "@/components/ProofLink";
import { uploadProof } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/abonos")({
  head: () => ({
    meta: [
      { title: "Abonos — HogarFin" },
      { name: "description", content: "Gestión y seguimiento de abonos a las deudas del hogar." },
      { property: "og:title", content: "Abonos — HogarFin" },
      { property: "og:description", content: "Gestión y seguimiento de abonos a las deudas del hogar." },
    ],
  }),
  component: Abonos,
});

function Abonos() {
  const { familyId, user, role } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [member, setMember] = useState("todos");
  const [debt, setDebt] = useState("todas");
  const [editing, setEditing] = useState<any>(null);
  const confirmar = useConfirm();

  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: pay }, { data: d }, { data: fm }] = await Promise.all([
      supabase.from("payments").select("*").eq("family_id", familyId).order("payment_date", { ascending: false }),
      supabase.from("debts").select("id, name, entity, total_amount").eq("family_id", familyId),
      supabase.from("family_members").select("user_id").eq("family_id", familyId),
    ]);
    const ids = (fm ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, email").in("id", ids)
      : { data: [] as any[] };
    setPayments(pay ?? []);
    setDebts(d ?? []);
    setProfiles(profs ?? []);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  const isAdmin = role === "admin";
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";
  const debtOf = (id: string) => debts.find((d) => d.id === id);

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (member !== "todos" && p.user_id !== member) return false;
        if (debt !== "todas" && p.debt_id !== debt) return false;
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return (
          (debtOf(p.debt_id)?.name ?? "").toLowerCase().includes(t) ||
          (debtOf(p.debt_id)?.entity ?? "").toLowerCase().includes(t) ||
          nameOf(p.user_id).toLowerCase().includes(t) ||
          (p.notes ?? "").toLowerCase().includes(t)
        );
      }),
    [payments, member, debt, q, profiles, debts],
  );

  const total = filtered.reduce((s, p) => s + Number(p.amount), 0);

  const porMiembro = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => map.set(p.user_id, (map.get(p.user_id) ?? 0) + Number(p.amount)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  async function borrar(p: any) {
    const ok = await confirmar({
      title: "Eliminar abono",
      description: `Se eliminará el abono de ${formatCOP(p.amount)}. El saldo de la deuda se recalculará automáticamente.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Abono eliminado");
    load();
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Abonos</h1>
        <p className="text-sm text-muted-foreground">Todos los pagos registrados a las deudas del hogar.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
              <HandCoins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase text-muted-foreground">Total abonado</div>
              <div className="break-words text-xl font-bold leading-tight">{formatCOP(total)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-1 lg:col-span-2">
          <CardContent className="flex flex-wrap gap-2 p-4">
            {porMiembro.length === 0 ? (
              <span className="text-sm text-muted-foreground">Sin abonos.</span>
            ) : (
              porMiembro.map(([uid, v]) => (
                <Badge key={uid} variant="secondary" className="font-normal">
                  {nameOf(uid)} · {formatCOP(v)}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar deuda, persona o nota…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las personas</SelectItem>
            {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={debt} onValueChange={setDebt}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las deudas</SelectItem>
            {debts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No hay abonos con estos filtros.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((p) => {
                const puede = isAdmin || p.created_by === user?.id || p.user_id === user?.id;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="min-w-0 flex-1 basis-[220px]">
                      <div className="break-words font-medium">{debtOf(p.debt_id)?.name ?? "Deuda"}</div>
                      <div className="break-words text-xs text-muted-foreground">
                        {nameOf(p.user_id)} · {formatDate(p.payment_date)}
                        {debtOf(p.debt_id)?.entity ? ` · ${debtOf(p.debt_id)?.entity}` : ""}
                      </div>
                      {p.notes && <div className="mt-0.5 break-words text-xs text-muted-foreground">{p.notes}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProofLink path={p.proof_url} />
                      <span className="font-bold text-success">{formatCOP(p.amount)}</span>
                      {puede && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => borrar(p)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Editar abono</DialogTitle></DialogHeader>
          {editing && (
            <EditPaymentForm
              payment={editing}
              profiles={profiles}
              userId={user!.id}
              onDone={() => { setEditing(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditPaymentForm({ payment, profiles, userId, onDone }: any) {
  const [target, setTarget] = useState<string>(payment.user_id);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let proof_url = payment.proof_url as string | null;
    try {
      if (file) proof_url = await uploadProof(userId, file);
    } catch (err: any) {
      setLoading(false);
      return toast.error(err.message ?? "No se pudo subir el comprobante");
    }
    const { error } = await supabase
      .from("payments")
      .update({
        amount: Number(fd.get("amount")),
        payment_date: String(fd.get("payment_date")),
        user_id: target,
        notes: String(fd.get("notes") || "") || null,
        proof_url,
      })
      .eq("id", payment.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Abono actualizado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" min="1" required defaultValue={payment.amount} /></div>
      <div>
        <Label>Abono a nombre de</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fecha</Label><Input name="payment_date" type="date" required defaultValue={payment.payment_date} /></div>
      <div><Label>Notas</Label><Textarea name="notes" defaultValue={payment.notes ?? ""} /></div>
      <div>
        <Label>Reemplazar comprobante (opcional)</Label>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {payment.proof_url && <div className="mt-2"><ProofLink path={payment.proof_url} label="Ver actual" /></div>}
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
    </form>
  );
}
