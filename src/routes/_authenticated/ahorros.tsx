import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, PiggyBank, Trophy, Unlock, Search, Upload, Pencil, Trash2, Medal, Shield, Flag } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { uploadProof } from "@/lib/storage";
import { ProofLink } from "@/components/ProofLink";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { mensajeAhorro } from "@/lib/whatsapp";
import { useConfirm } from "@/components/ConfirmDialog";

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
  const { user, role, familyId, familyName } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [goalMembers, setGoalMembers] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [debtMembers, setDebtMembers] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: g }, { data: gm }, { data: c }, { data: fm }, { data: b }, { data: d }, { data: dm }] = await Promise.all([
      supabase.from("savings_goals").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("savings_goal_members").select("*").eq("family_id", familyId),
      supabase.from("savings_contributions").select("*").eq("family_id", familyId).order("contribution_date", { ascending: false }),
      supabase.from("family_members").select("user_id").eq("family_id", familyId),
      supabase.from("badges").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("debts").select("id, name, status").eq("family_id", familyId).neq("status", "pagada"),
      supabase.from("debt_members").select("*").eq("family_id", familyId),
    ]);
    const ids = (fm ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, email, phone").in("id", ids)
      : { data: [] as any[] };
    setGoals(g ?? []);
    setGoalMembers(gm ?? []);
    setContribs(c ?? []);
    setProfiles(profs ?? []);
    setBadges(b ?? []);
    setDebts(d ?? []);
    setDebtMembers(dm ?? []);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  const canWrite = role !== "invitado";
  const isAdmin = role === "admin";
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Ahorros</h1>
          <p className="text-sm text-muted-foreground">Metas, responsables y aportes de la familia.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" /> Nueva meta</Button>
        )}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva meta de ahorro</DialogTitle></DialogHeader>
          <GoalForm
            profiles={profiles}
            userId={user!.id}
            familyId={familyId!}
            onDone={() => { setOpenNew(false); load(); }}
          />
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="metas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="retos">Retos</TabsTrigger>
          <TabsTrigger value="insignias">Insignias</TabsTrigger>
          <TabsTrigger value="aportes">Aportes</TabsTrigger>
        </TabsList>

        {(["metas", "retos"] as const).map((tab) => {
          const list = goals.filter((g) => (tab === "retos" ? g.is_challenge : !g.is_challenge));
          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {list.length === 0 ? (
                <Card><CardContent className="p-10 text-center text-muted-foreground">
                  {tab === "retos" ? "Aún no hay retos semanales." : "Aún no hay metas."}
                </CardContent></Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {list.map((g) => (
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
                      familyId={familyId!}
                      familyName={familyName}
                      debts={debts}
                      debtMembers={debtMembers}
                      onChange={load}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="insignias" className="mt-4">
          <BadgesTab badges={badges} nameOf={nameOf} profiles={profiles} />
        </TabsContent>

        <TabsContent value="aportes" className="mt-4">
          <ContributionsList
            contribs={contribs}
            goals={goals}
            nameOf={nameOf}
            profiles={profiles}
            isAdmin={isAdmin}
            userId={user!.id}
            onChange={load}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoalCard({ goal: g, members, contribs, profiles, nameOf, canWrite, isAdmin, userId, familyId, familyName, debts, debtMembers, onChange }: any) {
  const [openContrib, setOpenContrib] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openReserve, setOpenReserve] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [askRecreate, setAskRecreate] = useState(false);
  const confirmar = useConfirm();

  const esReto = !!g.is_challenge;
  const esReserva = g.goal_kind === "reserva";
  const hoy = new Date().toISOString().slice(0, 10);
  // lazy fallback: un reto vencido se muestra cerrado aunque el job no haya corrido
  const cerrado = esReto && (!!g.closed_at || (!!g.period_end && g.period_end < hoy));

  const target = Number(g.target_amount);
  const current = Number(g.current_amount);
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const done = pct >= 100;
  const restante = Math.max(0, target - current);
  const dias = g.due_date ? Math.max(1, daysUntil(g.due_date) ?? 1) : null;
  const asignados: string[] = members.map((m: any) => m.user_id);
  const porPersonaDia = dias && asignados.length ? restante / dias / asignados.length : null;

  const aportadoPor = (uid: string) =>
    contribs
      .filter((c: any) => c.user_id === uid)
      .reduce((s: number, c: any) => s + (c.kind === "retiro" ? -Number(c.amount) : Number(c.amount)), 0);
  const cuota = asignados.length ? target / asignados.length : target;

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    contribs.forEach((c: any) => {
      if (c.kind === "retiro") return;
      map.set(c.user_id, (map.get(c.user_id) ?? 0) + Number(c.amount));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [contribs]);
  const maxAporte = ranking[0]?.[1] ?? 0;

  async function romper() {
    const ok = await confirmar({
      title: "Romper la meta",
      description: `Se retirará todo el dinero ahorrado (${formatCOP(current)}) de "${g.name}". La meta se conserva y podrás reactivarla después.`,
      confirmText: "Romper y retirar",
      destructive: true,
    });
    if (!ok) return;
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
    setAskRecreate(true);
  }

  async function reactivar() {
    const { error } = await supabase.from("savings_goals").update({ broken_at: null }).eq("id", g.id);
    if (error) return toast.error(error.message);
    setAskRecreate(false);
    toast.success("Meta reiniciada desde cero");
    onChange();
  }

  async function eliminar() {
    const ok = await confirmar({
      title: "Eliminar meta",
      description: `Se eliminará "${g.name}" junto con todos sus aportes. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("savings_goals").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Meta eliminada");
    onChange();
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {done ? <Trophy className="h-5 w-5 shrink-0 text-warning" /> : <PiggyBank className="h-5 w-5 shrink-0 text-primary" />}
            <h3 className="min-w-0 break-words font-semibold">{g.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {esReserva && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Fondo de Reserva</Badge>}
            {esReto && (
              cerrado
                ? <Badge variant="secondary" className="gap-1"><Flag className="h-3 w-3" /> Reto cerrado</Badge>
                : <Badge className="gap-1"><Flag className="h-3 w-3" /> Reto</Badge>
            )}
            {esReto && g.period_start && g.period_end && (
              <span>{formatDate(g.period_start)} – {formatDate(g.period_end)}</span>
            )}
            {g.broken_at && <Badge variant="outline">Rota {formatDate(g.broken_at)}</Badge>}
            {g.due_date && !esReto && <span>{formatDate(g.due_date)}</span>}
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

        {esReto ? (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Ranking de aportantes</div>
            {ranking.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nadie ha aportado todavía.</p>
            ) : (
              ranking.map(([uid, ap], i) => (
                <div key={uid}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 break-words">
                      {i === 0 && <Medal className="h-3.5 w-3.5 shrink-0 text-warning" />}
                      <span className="text-muted-foreground">{i + 1}.</span> {nameOf(uid)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{formatCOP(ap)}</span>
                  </div>
                  <Progress value={maxAporte ? (ap / maxAporte) * 100 : 0} className="mt-1 h-1.5 transition-all duration-700" />
                </div>
              ))
            )}
            {cerrado && <p className="text-xs text-muted-foreground">El reto terminó. Las insignias se otorgan automáticamente.</p>}
          </div>
        ) : (
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
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 break-words">{nameOf(uid)}</span>
                    <span className="shrink-0 text-muted-foreground">{formatCOP(ap)} / {formatCOP(cuota)}</span>
                  </div>
                  <Progress value={p2} className="mt-1 h-1.5" />
                  <div className="mt-1 flex justify-end">
                    <WhatsAppButton
                      phone={profiles.find((p: any) => p.id === uid)?.phone}
                      variant="ghost"
                      label={done ? "Felicitar" : "Motivar por WhatsApp"}
                      className="h-7 px-2 text-[11px]"
                      message={mensajeAhorro({
                        nombre: nameOf(uid),
                        meta: g.name,
                        aportado: ap,
                        cuota,
                        restante,
                        porDia: porPersonaDia,
                        dias,
                        completada: done,
                        familia: familyName,
                        seed: uid.charCodeAt(0) + Math.floor(pct),
                      })}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite && !g.broken_at && !cerrado && (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpenContrib(true)}>Aportar</Button>
          )}
          {esReserva && isAdmin && current > 0 && (
            <Button size="sm" variant="outline" onClick={() => setOpenReserve(true)}>
              <Shield className="mr-1 h-4 w-4" /> Usar fondo
            </Button>
          )}
          {isAdmin && current > 0 && (
            <Button size="sm" variant="secondary" disabled={breaking} onClick={romper}>
              <Unlock className="mr-1 h-4 w-4" /> Romper meta
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setOpenEdit(true)}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={eliminar}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
              </Button>
            </>
          )}
        </div>

        <Dialog open={openContrib} onOpenChange={setOpenContrib}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Aportar a {g.name}</DialogTitle></DialogHeader>
            <ContribForm
              goal={g}
              people={profiles.filter((p: any) => (asignados.length ? asignados.includes(p.id) : true))}
              userId={userId}
              onDone={() => { setOpenContrib(false); onChange(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Editar meta</DialogTitle></DialogHeader>
            <GoalForm
              goal={g}
              existingMembers={members}
              profiles={profiles}
              userId={userId}
              familyId={familyId}
              onDone={() => { setOpenEdit(false); onChange(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openReserve} onOpenChange={setOpenReserve}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Usar Fondo de Reserva</DialogTitle></DialogHeader>
            <ReserveUseForm
              goal={g}
              disponible={current}
              debts={debts}
              debtMembers={debtMembers}
              profiles={profiles}
              nameOf={nameOf}
              onDone={() => { setOpenReserve(false); onChange(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={askRecreate} onOpenChange={setAskRecreate}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader><DialogTitle>¿Volver a crear la meta?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              La meta <b>{g.name}</b> quedó rota y sin fondos. ¿Quieres reactivarla para empezar a ahorrar de nuevo?
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setAskRecreate(false)}>No, dejarla rota</Button>
              <Button onClick={reactivar}>Sí, reactivarla</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ReserveUseForm({ goal, disponible, debts, debtMembers, profiles, nameOf, onDone }: any) {
  const [debtId, setDebtId] = useState<string>(debts[0]?.id ?? "");
  const [userId, setUserId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const responsables = useMemo(
    () => debtMembers.filter((m: any) => m.debt_id === debtId),
    [debtMembers, debtId],
  );

  useEffect(() => {
    setUserId(responsables[0]?.user_id ?? "");
  }, [debtId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(amount);
    if (!debtId || !userId) return toast.error("Selecciona la deuda y el miembro");
    if (!monto || monto <= 0) return toast.error("Monto inválido");
    if (monto > disponible) return toast.error("El fondo no tiene saldo suficiente");
    setLoading(true);
    const { error } = await supabase.rpc("use_reserve_for_debt", {
      _goal_id: goal.id,
      _debt_id: debtId,
      _user_id: userId,
      _amount: monto,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Fondo aplicado a la deuda");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Disponible en el fondo: <b>{formatCOP(disponible)}</b>. Se registrará un retiro del fondo y un abono a la deuda del miembro.
      </p>
      <div>
        <Label>Deuda</Label>
        <Select value={debtId} onValueChange={setDebtId}>
          <SelectTrigger><SelectValue placeholder="Selecciona una deuda" /></SelectTrigger>
          <SelectContent>
            {debts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Miembro</Label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger><SelectValue placeholder="Selecciona un miembro" /></SelectTrigger>
          <SelectContent>
            {(responsables.length
              ? responsables.map((m: any) => ({ id: m.user_id, name: nameOf(m.user_id) }))
              : profiles.map((p: any) => ({ id: p.id, name: p.name }))
            ).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Monto ($)</Label>
        <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading || !debts.length}>{loading ? "Aplicando…" : "Aplicar al pago"}</Button>
      </DialogFooter>
    </form>
  );
}

function BadgesTab({ badges, nameOf, profiles }: any) {
  const porUsuario = useMemo(() => {
    const map = new Map<string, any[]>();
    badges.forEach((b: any) => {
      map.set(b.user_id, [...(map.get(b.user_id) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [badges]);

  if (!badges.length) {
    return (
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        Aún no hay insignias. Se otorgan automáticamente al hacer el primer aporte, completar una meta o ganar un reto.
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {porUsuario.map(([uid, list]) => (
        <Card key={uid}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 break-words font-semibold">{nameOf(uid) !== "—" ? nameOf(uid) : profiles.find((p: any) => p.id === uid)?.email ?? "Miembro"}</h3>
              <Badge variant="secondary">{list.length} insignias</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {list.map((b: any) => (
                <Badge key={b.id} variant="outline" className="gap-1">
                  <Medal className="h-3 w-3 text-warning" />
                  <span className="break-words">{b.label}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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

function GoalForm({ goal, existingMembers = [], profiles, userId, familyId, onDone }: any) {
  const editing = !!goal;
  const [sel, setSel] = useState<string[]>(existingMembers.map((m: any) => m.user_id));
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name")),
      target_amount: Number(fd.get("target_amount")),
      due_date: String(fd.get("due_date") || "") || null,
      family_id: familyId,
    };

    let goalId = goal?.id as string | undefined;
    if (editing) {
      const { error } = await supabase.from("savings_goals").update(payload).eq("id", goal.id);
      if (error) { setLoading(false); return toast.error(error.message); }
      await supabase.from("savings_goal_members").delete().eq("goal_id", goal.id);
    } else {
      const { data, error } = await supabase
        .from("savings_goals")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();
      if (error || !data) { setLoading(false); return toast.error(error?.message ?? "Error"); }
      goalId = data.id;
    }
    if (sel.length) {
      await supabase.from("savings_goal_members").insert(sel.map((uid) => ({ goal_id: goalId!, user_id: uid })));
    }
    setLoading(false);
    toast.success(editing ? "Meta actualizada" : "Meta creada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input name="name" required placeholder="Vacaciones, Emergencia…" defaultValue={goal?.name} /></div>
      <div><Label>Meta ($)</Label><Input name="target_amount" type="number" step="0.01" min="1" required defaultValue={goal?.target_amount} /></div>
      <div><Label>Fecha objetivo</Label><Input name="due_date" type="date" defaultValue={goal?.due_date ?? ""} /></div>
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
        <p className="mt-2 text-xs text-muted-foreground">
          Nadie queda asignado automáticamente: selecciona a los responsables. La meta se reparte en partes iguales entre ellos.
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>{loading ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}</Button>
      </DialogFooter>
    </form>
  );
}

function ContributionsList({ contribs, goals, nameOf, profiles, isAdmin, userId, onChange }: any) {
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("todos");
  const [goalId, setGoalId] = useState("todas");
  const [editing, setEditing] = useState<any>(null);
  const confirmarMov = useConfirm();

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

  async function borrar(c: any) {
    const ok = await confirmarMov({
      title: "Eliminar movimiento",
      description: `Se eliminará el ${c.kind === "retiro" ? "retiro" : "aporte"} de ${formatCOP(c.amount)}. El saldo de la meta se recalculará.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("savings_contributions").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Movimiento eliminado");
    onChange();
  }

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
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <div className="break-words font-medium">{goalName(c.goal_id)}</div>
                    <div className="break-words text-xs text-muted-foreground">
                      {nameOf(c.user_id)} · {formatDate(c.contribution_date)}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProofLink path={c.proof_url} />
                    <span className={`font-bold ${c.kind === "retiro" ? "text-destructive" : "text-success"}`}>
                      {c.kind === "retiro" ? "-" : "+"}{formatCOP(c.amount)}
                    </span>
                    {isAdmin && (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => borrar(c)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Todos pueden consultar y abrir los comprobantes. Solo el administrador puede editar o eliminar aportes.
      </p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Editar aporte</DialogTitle></DialogHeader>
          {editing && (
            <EditContribForm
              contrib={editing}
              profiles={profiles}
              userId={userId}
              onDone={() => { setEditing(null); onChange(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditContribForm({ contrib, profiles, userId, onDone }: any) {
  const [target, setTarget] = useState<string>(contrib.user_id);
  const [kind, setKind] = useState<string>(contrib.kind ?? "aporte");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let proof_url = contrib.proof_url as string | null;
    try {
      if (file) proof_url = await uploadProof(userId, file);
    } catch (err: any) {
      setLoading(false);
      return toast.error(err.message ?? "No se pudo subir el comprobante");
    }
    const { error } = await supabase
      .from("savings_contributions")
      .update({
        amount: Number(fd.get("amount")),
        contribution_date: String(fd.get("contribution_date")),
        user_id: target,
        kind,
        notes: String(fd.get("notes") || "") || null,
        proof_url,
      })
      .eq("id", contrib.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Aporte actualizado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Monto</Label><Input name="amount" type="number" step="0.01" min="1" required defaultValue={contrib.amount} /></div>
      <div>
        <Label>Tipo</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aporte">Aporte</SelectItem>
            <SelectItem value="retiro">Retiro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>A nombre de</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fecha</Label><Input name="contribution_date" type="date" required defaultValue={contrib.contribution_date} /></div>
      <div><Label>Nota</Label><Input name="notes" defaultValue={contrib.notes ?? ""} /></div>
      <div>
        <Label>Reemplazar comprobante (opcional)</Label>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {contrib.proof_url && <div className="mt-2"><ProofLink path={contrib.proof_url} label="Ver actual" /></div>}
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
    </form>
  );
}
