import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Pencil, Trash2, PiggyBank, AlertTriangle, Tags, EyeOff, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { expenseMonthKey, expensesForMonth, isExpenseHistory, shiftExpenseMonth } from "@/lib/expense-history";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CajaMenor,
});

export type Categoria = { id: string; name: string; slug: string; active: boolean; sort_order: number };

/** Identificador estable a partir del nombre (los gastos guardan el slug). */
function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

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
  const [openCats, setOpenCats] = useState(false);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [editing, setEditing] = useState<any>(null);
  const [month, setMonth] = useState(() => expenseMonthKey(new Date()));
  const confirmar = useConfirm();
  const currentMonth = expenseMonthKey(new Date());
  const historical = isExpenseHistory(month);
  const monthLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00`));

  function selectMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value > currentMonth) return;
    setMonth(value);
    setOpenNew(false);
    setOpenBudget(false);
    setOpenCats(false);
    setEditing(null);
  }

  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: e }, { data: p }, { data: b }, { data: c }] = await Promise.all([
      supabase.from("expenses").select("*").eq("family_id", familyId).order("expense_date", { ascending: false }),
      supabase.from("profiles").select("id, name"),
      supabase.from("budgets").select("*").eq("family_id", familyId),
      supabase.from("expense_categories").select("*").eq("family_id", familyId).order("sort_order"),
    ]);
    setExpenses(e ?? []);
    setProfiles(p ?? []);
    setBudgets(b ?? []);
    setCats((c ?? []) as Categoria[]);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  const monthExpenses = useMemo(() => expensesForMonth(expenses, month), [expenses, month]);
  const filtered = monthExpenses.filter((x) => filter === "todos" || x.category === filter);

  const gastoMesPorCat = useMemo(() => {
    const m = new Map<string, number>();
    monthExpenses.forEach((x) => {
      m.set(x.category, (m.get(x.category) ?? 0) + Number(x.amount));
    });
    return m;
  }, [monthExpenses]);

  const totalMes = useMemo(() => [...gastoMesPorCat.values()].reduce((s, v) => s + v, 0), [gastoMesPorCat]);
  const limiteOf = (cat: string) => Number(budgets.find((b) => b.category === cat)?.monthly_limit ?? 0);
  const allSlugs = useMemo(() => {
    const s = new Set(cats.map((c) => c.slug));
    budgets.forEach((b) => s.add(b.category));
    return [...s];
  }, [cats, budgets]);
  const totalLimite = allSlugs.reduce((s, c) => s + limiteOf(c), 0);
  const conPresupuesto = allSlugs.filter((c) => limiteOf(c) > 0);
  const nameOf = (slug: string) => cats.find((c) => c.slug === slug)?.name ?? slug;
  const activeCats = cats.filter((c) => c.active);
  const enAlerta = conPresupuesto.filter((c) => (gastoMesPorCat.get(c) ?? 0) / limiteOf(c) >= 0.9);

  const canWrite = canWriteFinance(role);
  const isAdmin = isAdminRole(role);
  const canEditMonth = canWrite && !historical;

  async function removeExpense(id: string) {
    if (historical) return;
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
          {canEditMonth && (
            <Button variant="outline" onClick={() => setOpenCats(true)}>
              <Tags className="mr-1 h-4 w-4" /> Categorías
            </Button>
          )}
          {isAdmin && !historical && (
            <Button variant="outline" onClick={() => setOpenBudget(true)}>
              <PiggyBank className="mr-1 h-4 w-4" /> Presupuestos
            </Button>
          )}
          {canEditMonth && (
            <Button onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo gasto</Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <Button variant="outline" size="icon" aria-label="Mes anterior" title="Mes anterior" onClick={() => selectMonth(shiftExpenseMonth(month, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <Label htmlFor="expense-history-month" className="sr-only">Mes de gastos</Label>
          <Input id="expense-history-month" type="month" aria-label="Mes de gastos" value={month} max={currentMonth} onChange={(e) => selectMonth(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" size="icon" aria-label="Mes siguiente" title="Mes siguiente" disabled={month >= currentMonth} onClick={() => selectMonth(shiftExpenseMonth(month, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {historical && <Button variant="ghost" size="sm" onClick={() => selectMonth(currentMonth)}>Mes actual</Button>}
        {historical && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-4 w-4" /> Histórico · Solo lectura</span>}
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
              <div className="text-xs uppercase text-muted-foreground">Total · {monthLabel}</div>
              <div className="break-words text-2xl font-bold leading-tight">{formatCOP(totalMes)}</div>
              {!historical && totalLimite > 0 && (
                <div className="text-[11px] text-muted-foreground">Presupuesto total: {formatCOP(totalLimite)}</div>
              )}
            </div>
            <Receipt className="h-8 w-8 shrink-0 text-primary" />
          </CardContent>
        </Card>
        {!historical && enAlerta.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5 sm:col-span-1 lg:col-span-2">
            <CardContent className="flex items-start gap-3 p-5 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <div className="font-semibold text-destructive">Presupuesto al límite</div>
                <div className="break-words text-xs text-muted-foreground">
                  {enAlerta.map((c) => `${nameOf(c)} (${((gastoMesPorCat.get(c) ?? 0) / limiteOf(c) * 100).toFixed(0)}%)`).join(" · ")}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {historical ? (
        <section className="space-y-3 border-b pb-4" aria-label="Gastos por categoría">
          <h2 className="text-base font-semibold">Gastos por categoría · {monthLabel}</h2>
          {[...gastoMesPorCat.entries()].map(([category, amount]) => (
            <div key={category} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{nameOf(category)}</span>
              <span className="font-medium">{formatCOP(amount)}</span>
            </div>
          ))}
        </section>
      ) : <Card>
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
                    <span className="font-medium">{nameOf(c)}</span>
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
      </Card>}

      {canEditMonth && user && familyId && <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar gasto</DialogTitle></DialogHeader>
          <ExpenseForm
            userId={user.id}
            familyId={familyId}
            cats={activeCats}
            onDone={() => { setOpenNew(false); load(); }}
          />
        </DialogContent>
      </Dialog>}

      {isAdmin && !historical && familyId && <Dialog open={openBudget} onOpenChange={setOpenBudget}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Presupuesto mensual por categoría</DialogTitle></DialogHeader>
          <BudgetForm
            familyId={familyId}
            budgets={budgets}
            cats={activeCats}
            onDone={() => { setOpenBudget(false); load(); }}
          />
        </DialogContent>
      </Dialog>}

      {canEditMonth && familyId && <Dialog open={openCats} onOpenChange={setOpenCats}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Categorías de gasto</DialogTitle></DialogHeader>
          <CategoriesManager familyId={familyId} cats={cats} expenses={expenses} budgets={budgets} onChange={load} />
        </DialogContent>
      </Dialog>}

      {editing && isAdmin && !historical && (
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
                    {activeCats.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                    {!activeCats.some((c) => c.slug === editing.category) && (
                      <SelectItem value={editing.category}>{nameOf(editing.category)}</SelectItem>
                    )}
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
          <SelectTrigger className="w-44" aria-label="Filtrar por categoría"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {cats.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin gastos{filter !== "todos" ? ` de ${nameOf(filter)}` : ""} en {monthLabel}.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((x) => {
                const p = profiles.find((pr) => pr.id === x.paid_by);
                return (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="min-w-0 flex-1 basis-[200px]">
                      <div className="font-medium">{nameOf(x.category)}</div>
                      <div className="break-words text-xs text-muted-foreground">
                        {x.description || "—"} · {p?.name ?? "?"} · {formatDate(x.expense_date)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-bold">{formatCOP(x.amount)}</span>
                      {isAdmin && !historical && (
                        <>
                          <Button size="sm" variant="ghost" aria-label="Editar gasto" onClick={() => setEditing(x)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label="Eliminar gasto" onClick={() => removeExpense(x.id)}>
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

function ExpenseForm({ userId, familyId, cats, onDone }: { userId: string; familyId: string; cats: Categoria[]; onDone: () => void }) {
  const [cat, setCat] = useState<string>(cats[0]?.slug ?? "otros");
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
          if (d.category && cats.some((c) => c.slug === d.category)) setCat(d.category);
          if (d.entity && !desc) setDesc(d.entity);
        }}
      />
      <div><Label>Monto</Label><Input type="number" step="0.01" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div>
        <Label>Categoría</Label>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {cats.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fecha</Label><Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      <div><Label>Descripción</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalle del gasto" /></div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button></DialogFooter>
    </form>
  );
}

function BudgetForm({ familyId, budgets, cats, onDone }: { familyId: string; budgets: any[]; cats: Categoria[]; onDone: () => void }) {
  const CATEGORIAS = cats.map((c) => c.slug);
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
          : await supabase.from("budgets").insert({ family_id: familyId, category: c, monthly_limit: limite });
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
          <span className="min-w-0 flex-1 text-sm">{cats.find((x) => x.slug === c)?.name ?? c}</span>
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

function CategoriesManager({ familyId, cats, expenses, budgets, onChange }: {
  familyId: string; cats: Categoria[]; expenses: any[]; budgets: any[]; onChange: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const confirmar = useConfirm();

  useEffect(() => {
    setNames(Object.fromEntries(cats.map((c) => [c.id, c.name])));
  }, [cats]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = nuevo.trim();
    if (!name) return;
    let slug = slugify(name) || "categoria";
    if (cats.some((c) => c.slug === slug)) {
      const existente = cats.find((c) => c.slug === slug)!;
      if (!existente.active) {
        const { error } = await supabase.from("expense_categories").update({ active: true, name }).eq("id", existente.id);
        if (error) return toast.error(error.message);
        setNuevo(""); toast.success("Categoría reactivada"); return onChange();
      }
      return toast.error("Ya existe una categoría con ese nombre");
    }
    const { error } = await supabase.from("expense_categories").insert({
      family_id: familyId, name, slug, sort_order: cats.length + 1,
    });
    if (error) return toast.error(error.message);
    setNuevo("");
    toast.success("Categoría creada");
    onChange();
  }

  async function rename(c: Categoria) {
    const name = (names[c.id] ?? "").trim();
    if (!name || name === c.name) return;
    const { error } = await supabase.from("expense_categories").update({ name }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Nombre actualizado");
    onChange();
  }

  async function toggle(c: Categoria) {
    const { error } = await supabase.from("expense_categories").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    onChange();
  }

  async function remove(c: Categoria) {
    const enUso = expenses.some((x) => x.category === c.slug) || budgets.some((b) => b.category === c.slug);
    if (enUso) {
      const ok = await confirmar({
        title: "Categoría en uso",
        description: "Tiene gastos o presupuesto registrados, así que no se puede borrar sin dañar el historial. ¿Quieres desactivarla para que no aparezca en gastos nuevos?",
        confirmText: "Desactivar",
      });
      if (ok && c.active) toggle(c);
      return;
    }
    const ok = await confirmar({
      title: "Eliminar categoría",
      description: `Se eliminará «${c.name}».`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    onChange();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Organiza los gastos a tu manera: renombra, agrega o desactiva categorías. Las desactivadas no aparecen
        al registrar gastos nuevos, pero conservan su historial.
      </p>
      <ul className="space-y-2">
        {cats.map((c) => (
          <li key={c.id} className={`flex items-center gap-1 ${c.active ? "" : "opacity-60"}`}>
            <Input
              className="min-w-0 flex-1"
              value={names[c.id] ?? ""}
              onChange={(e) => setNames((s) => ({ ...s, [c.id]: e.target.value }))}
              onBlur={() => rename(c)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(c); } }}
              aria-label={`Nombre de ${c.name}`}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => toggle(c)} aria-label={c.active ? "Desactivar" : "Activar"}>
              {c.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <Input className="min-w-0 flex-1" placeholder="Nueva categoría (ej. Arriendo)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={40} />
        <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Agregar</Button>
      </form>
    </div>
  );
}
