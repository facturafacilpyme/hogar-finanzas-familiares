import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, PiggyBank, Trophy, Unlock, Search, Upload } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { uploadProof } from "@/lib/storage";
import { ProofLink } from "@/components/ProofLink";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ahorros")({
  head: () => ({
    meta: [
      { title: "Ahorros — HogarFin" },
      { name: "description", content: "Metas de ahorro familiar con responsables, sugerencias diarias y aportes." },
      { property: "og:title", content: "Ahorros — HogarFin" },
      { property: "og:description", content: "Metas de ahorro familiar con responsables, sugerencias diarias y aportes." },
    ],
  }),
  component: Ahorros,
});

function Ahorros() {
  const { user, role, familyId } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [goalMembers, setGoalMembers] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);

  async function load() {
    if (!familyId) return;
    const [{ data: g }, { data: gm }, { data: c }, { data: fm }] = await Promise.all([
      supabase.from("savings_goals").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("savings_goal_members").select("*").eq("family_id", familyId),
      supabase.from("savings_contributions").select("*").eq("family_id", familyId).order("contribution_date", { ascending: false }),
      supabase.from("family_members").select("user_id").eq("family_id", familyId),
    ]);
    const ids = (fm ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, email").in("id", ids)
      : { data: [] as any[] };
    setGoals(g ?? []);
    setGoalMembers(gm ?? []);
    setContribs(c ?? []);
    setProfiles(profs ?? []);
  }
  useEffect(() => { load(); }, [familyId]);

  const canWrite = role !== "invitado";
  const isAdmin = role === "admin";
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ahorros</h1>
          <p className="text-sm text-muted-foreground">Metas, responsables y aportes de la familia.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Nueva meta</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nueva meta de ahorro</DialogTitle></DialogHeader>
              <NewGoalForm
                profiles={profiles}
                userId={user!.id}
                familyId={familyId!}
                onDone={() => { setOpenNew(false); load(); }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="metas">
        <TabsList>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="aportes">Aportes</TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="mt-4 space-y-3">
          {goals.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay metas.</CardContent></Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  members={goalMembers.filter((m) => m.goal_id === g.id)}
                  contribs={contribs.filter((c) => c.goal_id === g.id)}
                  profiles={profiles}
                  nameOf={nameOf}
                  canWrite={canWrite}
                  isAdmin={isAdmin}
                  userId={user!.id}
                  onChange={load}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="aportes" className="mt-4">
          <ContributionsList contribs={contribs} goals={goals} nameOf={nameOf} profiles={profiles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoalCard({ goal: g, members, contribs, profiles, nameOf, canWrite, isAdmin, userId, onChange }: any) {
  const [openContrib, setOpenContrib] = useState(false);
  const [breaking, setBreaking] = useState(false);

  const target = Number(g.target_amount);
  const current = Number(g.current_amount);
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const done = pct >= 100;
  const restante = Math.max(0, target - current);
  const dias = g.due_date ? Math.max(1, daysUntil(g.due_date) ?? 1) : null;
  const asignados = members.length ? members.map((m: any) => m.user_id) : profiles.map((p: any) => p.id);
  const porPersonaDia = dias && asignados.length ? restante / dias / asignados.length : null;

  const aportadoPor = (uid: string) =>
    contribs
      .filter((c: any) => c.user_id === uid)
      .reduce((s: number, c: any) => s + (c.kind === "retiro" ? -Number(c.amount) : Number(c.amount)), 0);
  const cuota = asignados.length ? target / asignados.length : target;

  async function romper() {
    if (!confirm("¿Romper la meta y retirar todo el dinero ahorrado? La meta se conserva.")) return;
    setBreaking(true);
    if (current > 0) {
      const { error } = await supabase.from("savings_contributions").insert({
        goal_id: g.id,
        user_id: userId,
        created_by: userId,
        amount: current,
        kind: "retiro",
        contribution_date: new Date().toISOString().slice(0, 10),
        notes: "Meta rota: retiro total",
      });
      if (error) { setBreaking(false); return toast.error(error.message); }
    }
    await supabase.from("savings_goals").update({ broken_at: new Date().toISOString() }).eq("id", g.id);
    setBreaking(false);
    toast.success("Meta rota, dinero retirado");
    onChange();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {done ? <Trophy className="h-5 w-5 text-warning" /> : <PiggyBank className="h-5 w-5 text-primary" />}
            <h3 className="font-semibold">{g.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {g.broken_at && <Badge variant="outline">Rota {formatDate(g.broken_at)}</Badge>}
            {g.due_date && <span>{formatDate(g.due_date)}</span>}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span className="font-bold text-primary">{formatCOP(current)}</span>
            <span className="text-muted-foreground">{formatCOP(target)}</span>
          </div>
          <Progress value={pct} className="mt-2" />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Faltan {formatCOP(restante)}</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
        </div>

        {porPersonaDia !== null && restante > 0 && (
          <div className="mt-3 rounded-lg bg-accent/50 p-3 text-xs text-accent-foreground">
            Sugerencia: cada persona debe ahorrar <b>{formatCOP(porPersonaDia)}</b> al día
            {" "}({formatCOP(porPersonaDia * 7)} por semana) durante {dias} días para cumplir la meta.
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Responsables</div>
          {asignados.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin responsables asignados.</p>
          ) : (
            asignados.map((uid: string) => {
              const ap = aportadoPor(uid);
              const p2 = cuota ? Math.min(100, (ap / cuota) * 100) : 0;
              return (
                <div key={uid}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{nameOf(uid)}</span>
                    <span className="text-muted-foreground">{formatCOP(ap)} / {formatCOP(cuota)}</span>
                  </div>
                  <Progress value={p2} className="mt-1 h-1.5" />
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite && (
            <Dialog open={openContrib} onOpenChange={setOpenContrib}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1">Aportar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Aportar a {g.name}</DialogTitle></DialogHeader>
                <ContribForm
                  goal={g}
                  people={profiles.filter((p: any) => asignados.includes(p.id))}
                  userId={userId}
                  onDone={() => { setOpenContrib(false); onChange(); }}
                />
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && current > 0 && (
            <Button size="sm" variant="secondary" disabled={breaking} onClick={romper}>
              <Unlock className="mr-1 h-4 w-4" /> Romper meta
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContribForm({ goal, people, userId, onDone }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<string>(
    people.some((p: any) => p.id === userId) ? userId : (people[0]?.id ?? userId),
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let proof_url: string | null = null;
    try {
      proof_url = await uploadProof(userId, file);
    } catch (err: any) {
      setLoading(false);
      return toast.error(err.message ?? "No se pudo subir el comprobante");
    }
    const { error } = await supabase.from("savings_contributions").insert({
      goal_id: goal.id,
      user_id: target,
      created_by: userId,
      amount: Number(fd.get("amount")),
      contribution_date: String(fd.get("contribution_date")),
      kind: "aporte",
      proof_url,
      notes: String(fd.get("notes") || "") || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Aporte registrado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" min="1" required /></div>
      <div>
        <Label>Aporte a nombre de</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {people.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fecha</Label><Input name="contribution_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
      <div><Label>Nota (opcional)</Label><Input name="notes" placeholder="Detalle del aporte" /></div>
      <div>
        <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Comprobante (opcional)</Label>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button></DialogFooter>
    </form>
  );
}

function NewGoalForm({ profiles, userId, familyId, onDone }: any) {
  const [sel, setSel] = useState<string[]>([userId]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { data: g, error } = await supabase.from("savings_goals").insert({
      name: String(fd.get("name")),
      target_amount: Number(fd.get("target_amount")),
      due_date: String(fd.get("due_date") || "") || null,
      created_by: userId,
      family_id: familyId,
    }).select().single();
    if (error || !g) { setLoading(false); return toast.error(error?.message ?? "Error"); }
    if (sel.length) {
      await supabase.from("savings_goal_members").insert(sel.map((uid) => ({ goal_id: g.id, user_id: uid })));
    }
    setLoading(false);
    toast.success("Meta creada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input name="name" required placeholder="Vacaciones, Emergencia…" /></div>
      <div><Label>Meta ($)</Label><Input name="target_amount" type="number" step="0.01" min="1" required /></div>
      <div><Label>Fecha objetivo</Label><Input name="due_date" type="date" /></div>
      <div className="rounded-lg border p-3">
        <Label className="mb-2 block">¿A quién le corresponde esta meta?</Label>
        <div className="space-y-2">
          {profiles.map((p: any) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sel.includes(p.id)}
                onCheckedChange={(v) => setSel((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              />
              {p.name}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">La meta se reparte en partes iguales entre los seleccionados.</p>
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Creando…" : "Crear"}</Button></DialogFooter>
    </form>
  );
}

function ContributionsList({ contribs, goals, nameOf, profiles }: any) {
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("todos");
  const [goalId, setGoalId] = useState("todas");

  const goalName = (id: string) => goals.find((g: any) => g.id === id)?.name ?? "Meta";
  const filtered = useMemo(
    () =>
      contribs.filter((c: any) => {
        if (person !== "todos" && c.user_id !== person) return false;
        if (goalId !== "todas" && c.goal_id !== goalId) return false;
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return goalName(c.goal_id).toLowerCase().includes(t) || nameOf(c.user_id).toLowerCase().includes(t) || (c.notes ?? "").toLowerCase().includes(t);
      }),
    [contribs, person, goalId, q, goals],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={person} onValueChange={setPerson}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las personas</SelectItem>
            {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={goalId} onValueChange={setGoalId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las metas</SelectItem>
            {goals.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin aportes registrados.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{goalName(c.goal_id)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {nameOf(c.user_id)} · {formatDate(c.contribution_date)}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProofLink path={c.proof_url} />
                    <span className={`font-bold ${c.kind === "retiro" ? "text-destructive" : "text-success"}`}>
                      {c.kind === "retiro" ? "-" : "+"}{formatCOP(c.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Los aportes son solo de consulta: no se pueden editar ni eliminar.</p>
    </div>
  );
}