import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { queuedWrite } from "@/lib/syncQueue";

export const Route = createFileRoute("/_authenticated/caja-menor")({
  head: () => ({ meta: [{ title: "Caja Menor — HogarFin" }, { name: "description", content: "Gastos y caja menor." }] }),
  component: CajaMenor,
});

const CATEGORIAS = ["mercado", "transporte", "servicios", "salud", "otros"] as const;

function CajaMenor() {
  const { user, role, familyId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [cat, setCat] = useState<string>("mercado");
  const [editing, setEditing] = useState<any>(null);
  const confirmar = useConfirm();

  async function load() {
    if (!familyId) return;
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from("expenses").select("*").eq("family_id", familyId).order("expense_date", { ascending: false }),
      supabase.from("profiles").select("*"),
    ]);
    setExpenses(e ?? []);
    setProfiles(p ?? []);
  }
  useEffect(() => { load(); }, [familyId]);

  const filtered = expenses.filter((x) => filter === "todos" || x.category === filter);
  const totalMes = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((x) => {
        const d = new Date(x.expense_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, x) => s + Number(x.amount), 0);
  }, [expenses]);

  const canWrite = role !== "invitado";
  const isAdmin = role === "admin";

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
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Caja Menor</h1>
          <p className="text-sm text-muted-foreground">Gastos cotidianos del hogar.</p>
        </div>
        {canWrite && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Nuevo gasto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar gasto</DialogTitle></DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const { error, queued } = await queuedWrite({
                    table: "expenses",
                    op: "insert",
                    label: "Gasto de caja menor",
                    payload: {
                      amount: Number(fd.get("amount")),
                      category: cat,
                      description: String(fd.get("description") || "") || null,
                      expense_date: String(fd.get("expense_date")),
                      paid_by: user!.id,
                      family_id: familyId!,
                    },
                  });
                  if (error) return toast.error(error.message);
                  toast.success(queued ? "Sin conexión: el gasto se enviará al recuperar la señal" : "Gasto registrado");
                  setOpenNew(false);
                  load();
                }}
                className="space-y-3"
              >
                <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={cat} onValueChange={setCat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Fecha</Label><Input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                <div><Label>Descripción</Label><Input name="description" /></div>
                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
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

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Total este mes</div>
            <div className="text-2xl font-bold">{formatCOP(totalMes)}</div>
          </div>
          <Receipt className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>

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