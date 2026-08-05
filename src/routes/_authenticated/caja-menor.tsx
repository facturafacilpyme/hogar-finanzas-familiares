import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Pencil, Trash2, PiggyBank, AlertTriangle } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { queuedWrite } from "@/lib/syncQueue";
import { OcrScan } from "@/components/OcrScan";
import { canWriteFinance, isAdminRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/caja-menor")({
  head: () => ({
    meta: [
      { title: "Caja Menor — HogarFin" },
      { name: "description", content: "Gastos, presupuestos por categoría y alertas de consumo del hogar." },
      { property: "og:title", content: "Caja Menor — HogarFin" },
      { property: "og:description", content: "Gastos, presupuestos por categoría y alertas de consumo del hogar." },
    ],
  }),
  component: CajaMenor,
});

const CATEGORIAS = ["mercado", "transporte", "servicios", "salud", "otros"] as const;

function tonoPresupuesto(pct: number) {
  if (pct >= 90) return { bar: "bg-destructive", text: "text-destructive", label: "Excedido / crítico" };
  if (pct >= 70) return { bar: "bg-warning", text: "text-warning-foreground", label: "Atención" };
  return { bar: "bg-success", text: "text-success", label: "En control" };
}

function CajaMenor() {
  const { user, role, familyId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openBudget, setOpenBudget] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [editing, setEditing] = useState<any>(null);
  const confirmar = useConfirm();

  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: e }, { data: p }, { data: b }] = await Promise.all([
      supabase.from("expenses").select("*").eq("family_id", familyId).order("expense_date", { ascending: false }),
      supabase.from("profiles").select("id, name"),
      supabase.from("budgets").select("*").eq("family_id", familyId),
    ]);
    setExpenses(e ?? []);
    setProfiles(p ?? []);
    setBudgets(b ?? []);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  const filtered = expenses.filter((x) => filter === "todos" || x.category === filter);

  const gastoMesPorCat = useMemo(() => {
    const now = new Date();
    const m = new Map<string, number>();
    expenses.forEach((x) => {
      const d = new Date(x.expense_date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
      m.set(x.category, (m.get(x.category) ?? 0) + Number(x.amount));
    });
    return m;
  }, [expenses]);

  const totalMes = useMemo(() => [...gastoMesPorCat.values()].reduce((s, v) => s + v, 0), [gastoMesPorCat]);
  const limiteOf = (cat: string) => Number(budgets.find((b) => b.category === cat)?.monthly_limit ?? 0);
  const totalLimite = CATEGORIAS.reduce((s, c) => s + limiteOf(c), 0);
  const conPresupuesto = CATEGORIAS.filter((c) => limiteOf(c) > 0);
  const enAlerta = conPresupuesto.filter((c) => (gastoMesPorCat.get(c) ?? 0) / limiteOf(c) >= 0.9);

  const canWrite = canWriteFinance(role);
  const isAdmin = isAdminRole(role);

  async function removeExpense(id: string) {
    const ok = await confirmar({
      title: "Eliminar gasto",
      description: "El gasto se quitará de la caja menor. Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gasto eliminado");
    load();
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Caja Menor</h1>
          <p className="text-sm text-muted-foreground">Gastos cotidianos y presupuestos del hogar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setOpenBudget(true)}>
              <PiggyBank className="mr-1 h-4 w-4" /> Presupuestos
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo gasto</Button>
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="rounded-xl border bg-accent/40 p-3 text-xs text-accent-foreground">
          Tu rol es de solo consulta en la caja menor: puedes ver los gastos y el consumo del presupuesto, pero no registrarlos.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="min-w-0">
              <div className="text-xs uppercase text-muted-foreground">Total este mes</div>
              <div className="break-words text-2xl font-bold leading-tight">{formatCOP(totalMes)}</div>
              {totalLimite > 0 && (
                <div className="text-[11px] text-muted-foreground">Presupuesto total: {formatCOP(totalLimite)}</div>
              )}
            </div>
            <Receipt className="h-8 w-8 shrink-0 text-primary" />
          </CardContent>
        </Card>
        {enAlerta.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5 sm:col-span-1 lg:col-span-2">
            <CardContent className="flex items-start gap-3 p-5 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <div className="font-semibold text-destructive">Presupuesto al límite</div>
                <div className="break-words text-xs text-muted-foreground">
                  {enAlerta.map((c) => `${c} (${((gastoMesPorCat.get(c) ?? 0) / limiteOf(c) * 100).toFixed(0)}%)`).join(" · ")}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Consumo del presupuesto mensual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conPresupuesto.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Aún no defines límites. Usa el botón «Presupuestos» para poner un tope mensual por categoría."
                : "El administrador aún no ha definido presupuestos por categoría."}
            </p>
          ) : (
            conPresupuesto.map((c) => {
              const gastado = gastoMesPorCat.get(c) ?? 0;
              const limite = limiteOf(c);
              const pct = limite > 0 ? (gastado / limite) * 100 : 0;
              const t = tonoPresupuesto(pct);
              return (
                <div key={c}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{c}</span>
                    <span className="break-words text-xs text-muted-foreground">
                      {formatCOP(gastado)} / {formatCOP(limite)} · <b className={t.text}>{pct.toFixed(0)}% · {t.label}</b>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  {pct >= 100 && (
                    <div className="mt-1 text-[11px] text-destructive">
                      Excedido en {formatCOP(gastado - limite)}.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar gasto</DialogTitle></DialogHeader>
          <ExpenseForm
            userId={user!.id}
            familyId={familyId!}
            onDone={() => { setOpenNew(false); load(); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openBudget} onOpenChange={setOpenBudget}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Presupuesto mensual por categoría</DialogTitle></DialogHeader>
          <BudgetForm
            familyId={familyId!}
            budgets={budgets}
            onDone={() => { setOpenBudget(false); load(); }}
          />
        </DialogContent>
      </Dialog>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Editar gasto</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const { error } = await supabase
                  .from("expenses")
                  .update({
                    amount: Number(fd.get("amount")),
                    category: editing.category as any,
                    description: String(fd.get("description") || "") || null,
                    expense_date: String(fd.get("expense_date")),
                  })
                  .eq("id", editing.id);
                if (error) return toast.error(error.message);
                toast.success("Gasto actualizado");
                setEditing(null);
                load();
              }}
            >
              <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" defaultValue={editing.amount} required /></div>
              <div>
                <Label>Categoría</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing((s: any) => ({ ...s, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha</Label><Input name="expense_date" type="date" defaultValue={editing.expense_date} required /></div>
              <div><Label>Descripción</Label><Input name="description" defaultValue={editing.description ?? ""} /></div>
              <DialogFooter><Button type="submit">Guardar cambios</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex justify-end">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin gastos.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((x) => {
                const p = profiles.find((pr) => pr.id === x.paid_by);
                return (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="min-w-0 flex-1 basis-[200px]">
                      <div className="font-medium capitalize">{x.category}</div>
                      <div className="break-words text-xs text-muted-foreground">
                        {x.description || "—"} · {p?.name ?? "?"} · {formatDate(x.expense_date)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-bold">{formatCOP(x.amount)}</span>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(x)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeExpense(x.id)}>
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
    </div>
  );
}

function ExpenseForm({ userId, familyId, onDone }: { userId: string; familyId: string; onDone: () => void }) {
  const [cat, setCat] = useState<string>("mercado");
  const [amount, setAmount] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, queued } = await queuedWrite({
      table: "expenses",
      op: "insert",
      label: "Gasto de caja menor",
      payload: {
        amount: Number(amount),
        category: cat,
        description: desc.trim() || null,
        expense_date: fecha,
        paid_by: userId,
        family_id: familyId,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(queued ? "Sin conexión: el gasto se enviará al recuperar la señal" : "Gasto registrado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <OcrScan
        title="Leer recibo automáticamente"
        hint="Toma la foto del recibo y llenamos el monto, la fecha y la categoría por ti."
        onResult={(d) => {
          if (d.amount) setAmount(String(d.amount));
          if (d.date) setFecha(d.date);
          if (d.category) setCat(d.category);
          if (d.entity && !desc) setDesc(d.entity);
        }}
      />
      <div><Label>Monto</Label><Input type="number" step="0.01" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div>
        <Label>Categoría</Label>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fecha</Label><Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      <div><Label>Descripción</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalle del gasto" /></div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button></DialogFooter>
    </form>
  );
}

function BudgetForm({ familyId, budgets, onDone }: { familyId: string; budgets: any[]; onDone: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    CATEGORIAS.forEach((c) => {
      const b = budgets.find((x) => x.category === c);
      init[c] = b ? String(Number(b.monthly_limit)) : "";
    });
    return init;
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    for (const c of CATEGORIAS) {
      const limite = Number(vals[c] || 0);
      const existente = budgets.find((x) => x.category === c);
      if (limite > 0) {
        const { error } = existente
          ? await supabase.from("budgets").update({ monthly_limit: limite }).eq("id", existente.id)
          : await supabase.from("budgets").insert({ family_id: familyId, category: c as any, monthly_limit: limite });
        if (error) { setLoading(false); return toast.error(error.message); }
      } else if (existente) {
        await supabase.from("budgets").delete().eq("id", existente.id);
      }
    }
    setLoading(false);
    toast.success("Presupuestos actualizados");
    onDone();
  }

  const total = CATEGORIAS.reduce((s, c) => s + Number(vals[c] || 0), 0);

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Define cuánto puede gastar el hogar cada mes en cada categoría. Deja en blanco o en cero para no controlar esa categoría.
      </p>
      {CATEGORIAS.map((c) => (
        <div key={c} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm capitalize">{c}</span>
          <Input
            type="number"
            min="0"
            step="1000"
            className="w-32 shrink-0"
            placeholder="0"
            value={vals[c]}
            onChange={(e) => setVals((s) => ({ ...s, [c]: e.target.value }))}
          />
        </div>
      ))}
      <div className="text-right text-xs text-muted-foreground">Presupuesto total: {formatCOP(total)}</div>
      <div className="rounded-lg bg-accent/40 p-2 text-[11px] text-accent-foreground">
        Semáforo: <b className="text-success">verde</b> hasta 70%, <b className="text-warning-foreground">amarillo</b> entre 70% y 90%,
        {" "}<b className="text-destructive">rojo</b> por encima del 90%.
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar presupuestos"}</Button></DialogFooter>
    </form>
  );
}
