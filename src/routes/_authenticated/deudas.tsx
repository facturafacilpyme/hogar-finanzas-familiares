import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet, Upload } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deudas")({
  head: () => ({ meta: [{ title: "Deudas — HogarFin" }, { name: "description", content: "Gestión de deudas familiares." }] }),
  component: Deudas,
});

function Deudas() {
  const { user, role, familyId } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [openNew, setOpenNew] = useState(false);

  async function load() {
    if (!familyId) return;
    const [{ data: d }, { data: m }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from("debts").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("debt_members").select("*").eq("family_id", familyId),
      supabase.from("family_members").select("profiles:user_id(id, name, email)").eq("family_id", familyId),
      supabase.from("payments").select("*").eq("family_id", familyId),
    ]);
    setDebts(d ?? []);
    setMembers(m ?? []);
    setProfiles((p ?? []).map((x: any) => x.profiles).filter(Boolean));
    setPayments(pay ?? []);
  }
  useEffect(() => { load(); }, [familyId]);

  const filtered = debts.filter((d) => filterStatus === "todos" || d.status === filterStatus);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deudas</h1>
          <p className="text-sm text-muted-foreground">Todas las obligaciones del hogar.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activa">Activas</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="mora">En mora</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" /> Nueva</Button>
              </DialogTrigger>
              <NewDebtDialog profiles={profiles} onDone={() => { setOpenNew(false); load(); }} userId={user!.id} familyId={familyId!} />
            </Dialog>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin deudas registradas.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              members={members.filter((m) => m.debt_id === d.id)}
              profiles={profiles}
              payments={payments.filter((p) => p.debt_id === d.id)}
              onChange={load}
              canPay={role !== "invitado"}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DebtCard({ debt, members, profiles, payments, onChange, canPay, isAdmin }: any) {
  const paid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(debt.total_amount) - paid);
  const days = daysUntil(debt.due_date);
  const [openPay, setOpenPay] = useState(false);

  const status =
    remaining <= 0 ? "pagada" : days !== null && days < 0 ? "mora" : days !== null && days <= 3 ? "por_vencer" : "activa";
  const statusMap: Record<string, { label: string; cls: string }> = {
    pagada: { label: "Pagada", cls: "bg-success/15 text-success" },
    mora: { label: "En mora", cls: "bg-destructive/15 text-destructive" },
    por_vencer: { label: "Por vencer", cls: "bg-warning/30 text-warning-foreground" },
    activa: { label: "Al día", cls: "bg-primary/10 text-primary" },
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="truncate font-semibold">{debt.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMap[status].cls}`}>
                {statusMap[status].label}
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {debt.entity} · {debt.debt_type === "cuotas" ? `${debt.total_cuotas} cuotas` : "Pago único"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{formatCOP(remaining)}</div>
            <div className="text-xs text-muted-foreground">de {formatCOP(debt.total_amount)}</div>
          </div>
        </div>

        {members.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {members.map((m: any) => {
              const p = profiles.find((pr: any) => pr.id === m.user_id);
              return (
                <Badge key={m.id} variant="secondary" className="font-normal">
                  {p?.name ?? "?"} · {m.percentage}% · {formatCOP(m.amount_assigned)}
                </Badge>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Vence: {formatDate(debt.due_date)}</span>
          <div className="flex gap-2">
            {canPay && (
              <Dialog open={openPay} onOpenChange={setOpenPay}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Registrar abono</Button>
                </DialogTrigger>
                <PaymentDialog debt={debt} onDone={() => { setOpenPay(false); onChange(); }} />
              </Dialog>
            )}
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={async () => {
                if (!confirm("¿Eliminar esta deuda?")) return;
                await supabase.from("debts").delete().eq("id", debt.id);
                toast.success("Deuda eliminada");
                onChange();
              }}>Eliminar</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewDebtDialog({ profiles, onDone, userId, familyId }: any) {
  const [type, setType] = useState<"unico" | "cuotas">("unico");
  const [total, setTotal] = useState("");
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const totalN = Number(fd.get("total_amount"));
    const totalPct = Object.values(assign).reduce((s, v) => s + Number(v || 0), 0);
    if (Math.abs(totalPct - 100) > 0.1) {
      toast.error(`Los porcentajes deben sumar 100% (van ${totalPct}%)`);
      return;
    }
    setLoading(true);
    const totalCuotas = type === "cuotas" ? Number(fd.get("total_cuotas")) : null;
    const cuotaAmount = type === "cuotas" && totalCuotas ? totalN / totalCuotas : null;
    const { data: d, error } = await supabase.from("debts").insert({
      name: String(fd.get("name")),
      entity: String(fd.get("entity")),
      total_amount: totalN,
      debt_type: type,
      total_cuotas: totalCuotas,
      cuota_amount: cuotaAmount,
      due_date: (String(fd.get("due_date")) || null),
      notes: String(fd.get("notes") || "") || null,
      created_by: userId,
      family_id: familyId,
    }).select().single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = Object.entries(assign)
      .filter(([, v]) => Number(v) > 0)
      .map(([uid, pct]) => ({
        debt_id: d.id,
        user_id: uid,
        percentage: Number(pct),
        amount_assigned: (Number(pct) / 100) * totalN,
      }));
    if (rows.length) await supabase.from("debt_members").insert(rows);
    toast.success("Deuda creada");
    setLoading(false);
    onDone();
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nueva deuda</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Nombre</Label><Input name="name" required /></div>
        <div><Label>Entidad</Label><Input name="entity" required placeholder="Banco, casa, etc." /></div>
        <div><Label>Valor total</Label><Input name="total_amount" type="number" step="0.01" required value={total} onChange={(e) => setTotal(e.target.value)} /></div>
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unico">Pago único</SelectItem>
              <SelectItem value="cuotas">A cuotas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type === "cuotas" && (
          <div><Label># de cuotas</Label><Input name="total_cuotas" type="number" min="1" required /></div>
        )}
        <div><Label>Fecha de vencimiento</Label><Input name="due_date" type="date" /></div>
        <div><Label>Notas</Label><Textarea name="notes" /></div>

        <div className="rounded-lg border p-3">
          <Label className="mb-2 block">Responsables (%)</Label>
          <div className="space-y-2">
            {profiles.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{p.name}</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-24"
                  placeholder="0"
                  value={assign[p.id] ?? ""}
                  onChange={(e) => setAssign((s) => ({ ...s, [p.id]: e.target.value }))}
                />
                <span className="w-24 text-right text-xs text-muted-foreground">
                  {total ? formatCOP((Number(assign[p.id] || 0) / 100) * Number(total)) : "$0"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-xs text-muted-foreground">
            Suma: {Object.values(assign).reduce((s, v) => s + Number(v || 0), 0)}%
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "Creando…" : "Crear deuda"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function PaymentDialog({ debt, onDone }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let proof_url: string | null = null;
    if (file) {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, file);
      if (upErr) { toast.error(upErr.message); setLoading(false); return; }
      proof_url = path;
    }
    const { error } = await supabase.from("payments").insert({
      debt_id: debt.id,
      user_id: user!.id,
      amount: Number(fd.get("amount")),
      payment_date: String(fd.get("payment_date")),
      proof_url,
      notes: String(fd.get("notes") || "") || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Abono registrado");
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Registrar abono — {debt.name}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" required /></div>
        <div><Label>Fecha</Label><Input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
        <div>
          <Label>Comprobante (foto)</Label>
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div><Label>Notas</Label><Textarea name="notes" /></div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar abono"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}