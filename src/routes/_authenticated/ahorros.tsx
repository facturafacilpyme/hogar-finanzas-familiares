import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, PiggyBank, Trophy } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ahorros")({
  head: () => ({ meta: [{ title: "Ahorros — HogarFin" }, { name: "description", content: "Metas de ahorro familiar." }] }),
  component: Ahorros,
});

function Ahorros() {
  const { user, role } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openContrib, setOpenContrib] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("savings_goals").select("*").order("created_at", { ascending: false });
    setGoals(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const canWrite = role !== "invitado";
  const isAdmin = role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ahorros</h1>
          <p className="text-sm text-muted-foreground">Metas y contribuciones familiares.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Nueva meta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva meta de ahorro</DialogTitle></DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const { error } = await supabase.from("savings_goals").insert({
                    name: String(fd.get("name")),
                    target_amount: Number(fd.get("target_amount")),
                    target_date: String(fd.get("target_date") || "") || null,
                    description: String(fd.get("description") || "") || null,
                    created_by: user!.id,
                  });
                  if (error) return toast.error(error.message);
                  toast.success("Meta creada");
                  setOpenNew(false);
                  load();
                }}
                className="space-y-3"
              >
                <div><Label>Nombre</Label><Input name="name" required placeholder="Vacaciones, Emergencia…" /></div>
                <div><Label>Meta ($)</Label><Input name="target_amount" type="number" step="0.01" required /></div>
                <div><Label>Fecha objetivo</Label><Input name="target_date" type="date" /></div>
                <div><Label>Descripción</Label><Input name="description" /></div>
                <DialogFooter><Button type="submit">Crear</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {goals.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay metas.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
            const done = pct >= 100;
            return (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {done ? <Trophy className="h-5 w-5 text-warning" /> : <PiggyBank className="h-5 w-5 text-primary" />}
                      <h3 className="font-semibold">{g.name}</h3>
                    </div>
                    {g.target_date && <span className="text-xs text-muted-foreground">{formatDate(g.target_date)}</span>}
                  </div>
                  {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-primary">{formatCOP(g.current_amount)}</span>
                      <span className="text-muted-foreground">{formatCOP(g.target_amount)}</span>
                    </div>
                    <Progress value={pct} className="mt-2" />
                    <div className="mt-1 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                  </div>
                  {canWrite && !done && (
                    <Dialog open={openContrib === g.id} onOpenChange={(o) => setOpenContrib(o ? g.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="mt-3 w-full">Aportar</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Aportar a {g.name}</DialogTitle></DialogHeader>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const { error } = await supabase.from("savings_contributions").insert({
                              goal_id: g.id,
                              user_id: user!.id,
                              amount: Number(fd.get("amount")),
                              contribution_date: String(fd.get("contribution_date")),
                              notes: String(fd.get("notes") || "") || null,
                            });
                            if (error) return toast.error(error.message);
                            toast.success("Aporte registrado");
                            setOpenContrib(null);
                            load();
                          }}
                          className="space-y-3"
                        >
                          <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" required /></div>
                          <div><Label>Fecha</Label><Input name="contribution_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                          <div><Label>Notas</Label><Input name="notes" /></div>
                          <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}