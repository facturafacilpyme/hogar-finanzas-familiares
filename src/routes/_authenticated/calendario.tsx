import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { memberBreakdown, sum } from "@/lib/debts";
import { nivelRiesgo, RIESGO_META } from "@/lib/strategy";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario — HogarFin" },
      { name: "description", content: "Calendario mensual de pagos y metas de ahorro con saldos reales." },
      { property: "og:title", content: "Calendario — HogarFin" },
      { property: "og:description", content: "Calendario mensual de pagos y metas de ahorro con saldos reales." },
    ],
  }),
  component: Calendario,
});

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["D", "L", "M", "X", "J", "V", "S"];

function Calendario() {
  const { familyId } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [debtMembers, setDebtMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [goalMembers, setGoalMembers] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [ref, setRef] = useState(new Date());

  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: d }, { data: dm }, { data: pay }, { data: g }, { data: gm }, { data: c }, { data: fm }] =
      await Promise.all([
        supabase.from("debts").select("*").eq("family_id", familyId),
        supabase.from("debt_members").select("*").eq("family_id", familyId),
        supabase.from("payments").select("*").eq("family_id", familyId),
        supabase.from("savings_goals").select("*").eq("family_id", familyId),
        supabase.from("savings_goal_members").select("*").eq("family_id", familyId),
        supabase.from("savings_contributions").select("*").eq("family_id", familyId),
        supabase.from("family_members").select("user_id").eq("family_id", familyId),
      ]);
    const ids = (fm ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] as any[] };
    setDebts(d ?? []);
    setDebtMembers(dm ?? []);
    setPayments(pay ?? []);
    setGoals(g ?? []);
    setGoalMembers(gm ?? []);
    setContribs(c ?? []);
    setProfiles(profs ?? []);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";

  /** Riesgo de mora: deudas con saldo que vencen dentro de 5 días o ya vencieron. */
  const riesgos = useMemo(() => {
    return debts
      .map((d) => {
        const pays = payments.filter((p) => p.debt_id === d.id);
        const pendiente = Number(d.total_amount) - sum(pays);
        const dias = daysUntil(d.due_date);
        return { debt: d, pendiente, dias, riesgo: nivelRiesgo(dias, pendiente) };
      })
      .filter((x) => x.riesgo === "critico" || x.riesgo === "alto" || x.riesgo === "medio")
      .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  }, [debts, payments]);

  const y = ref.getFullYear();
  const m = ref.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const byDay = useMemo(() => {
    const map = new Map<number, any[]>();
    const push = (day: number, item: any) => map.set(day, [...(map.get(day) ?? []), item]);
    const inMonth = (raw: string) => {
      const date = new Date(raw);
      return date.getFullYear() === y && date.getMonth() === m ? date.getDate() : null;
    };

    debts.forEach((d) => {
      if (!d.due_date) return;
      const day = inMonth(d.due_date);
      if (!day) return;
      const pays = payments.filter((p) => p.debt_id === d.id);
      const paid = sum(pays);
      const remaining = Math.max(0, Number(d.total_amount) - paid);
      if (remaining <= 0.5) return;
      const breakdown = memberBreakdown(debtMembers.filter((mm) => mm.debt_id === d.id), pays);
      push(day, { ...d, kind: "deuda", paid, remaining, breakdown, pct: Number(d.total_amount) ? (paid / Number(d.total_amount)) * 100 : 0 });
    });

    goals.forEach((g) => {
      if (!g.due_date || g.broken_at) return;
      const day = inMonth(g.due_date);
      if (!day) return;
      const current = Number(g.current_amount);
      const target = Number(g.target_amount);
      if (current >= target) return;
      const gcs = contribs.filter((c) => c.goal_id === g.id);
      const asignados = goalMembers.filter((mm) => mm.goal_id === g.id).map((mm) => mm.user_id);
      const cuota = asignados.length ? target / asignados.length : target;
      const breakdown = asignados.map((uid) => {
        const ap = gcs
          .filter((c) => c.user_id === uid)
          .reduce((s, c) => s + (c.kind === "retiro" ? -Number(c.amount) : Number(c.amount)), 0);
        return { user_id: uid, paid: ap, assigned: cuota, pending: Math.max(0, cuota - ap), pct: cuota ? Math.min(100, (ap / cuota) * 100) : 0 };
      });
      push(day, { ...g, kind: "meta", paid: current, remaining: target - current, breakdown, pct: target ? (current / target) * 100 : 0 });
    });

    return map;
  }, [debts, debtMembers, payments, goals, goalMembers, contribs, y, m]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setRef(new Date(y, m - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-32 text-center text-sm font-semibold sm:min-w-40">{MESES[m]} {y}</div>
          <Button size="icon" variant="outline" onClick={() => setRef(new Date(y, m + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {riesgos.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <ShieldAlert className="h-4 w-4" /> Riesgo de mora
            </div>
            <p className="text-xs text-muted-foreground">
              Estas obligaciones vencen dentro de los próximos 5 días o ya se vencieron. Actúa antes de que generen intereses.
            </p>
            <ul className="space-y-2">
              {riesgos.map(({ debt, pendiente, dias, riesgo }) => (
                <li key={debt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium">{debt.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${RIESGO_META[riesgo!].cls}`}>
                        {RIESGO_META[riesgo!].label}
                      </span>
                    </div>
                    <div className="break-words text-xs text-muted-foreground">
                      {debt.entity} · {formatCOP(pendiente)} pendiente · vence {formatDate(debt.due_date)}
                      {dias !== null && (dias < 0 ? ` (hace ${Math.abs(dias)}d)` : dias === 0 ? " (hoy)" : ` (en ${dias}d)`)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link to="/deudas">Registrar abono</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {DIAS.map((d) => <div key={d} className="p-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((c, i) => (
              <div
                key={i}
                className={`min-h-14 min-w-0 rounded-lg border p-0.5 text-xs sm:min-h-16 sm:p-1 ${c ? "bg-background" : "bg-muted/30"} ${c && isToday(c) ? "ring-2 ring-primary" : ""}`}
              >
                {c && <>
                  <div className="text-right text-[11px] font-semibold">{c}</div>
                  {(byDay.get(c) ?? []).slice(0, 2).map((d) => (
                    <div
                      key={d.id}
                      className={`mt-0.5 truncate rounded px-1 text-[9px] font-medium sm:text-[10px] ${
                        d.kind === "meta" ? "bg-success/20 text-success" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {d.name}
                    </div>
                  ))}
                  {(byDay.get(c)?.length ?? 0) > 2 && (
                    <div className="text-[9px] text-muted-foreground">+{(byDay.get(c)!.length - 2)} más</div>
                  )}
                </>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Pagos y metas del mes</h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> Deuda
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" /> Meta de ahorro
          </span>
        </div>
        {byDay.size === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nada pendiente este mes.</CardContent></Card>
        )}
        {[...byDay.entries()].sort(([a], [b]) => a - b).map(([day, items]) => (
          <Card key={day}>
            <CardContent className="space-y-3 p-3">
              <div className="text-xs font-semibold text-muted-foreground">Día {day}</div>
              {items.map((d) => (
                <div key={d.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">
                      {d.name} ·{" "}
                      <span className="text-muted-foreground">{d.kind === "meta" ? "Meta de ahorro" : d.entity}</span>
                    </span>
                    <span className={`shrink-0 font-semibold ${d.kind === "meta" ? "text-success" : ""}`}>
                      {formatCOP(d.remaining)} {d.kind === "meta" ? "por reunir" : "pendiente"}
                    </span>
                  </div>
                  <Progress value={Math.min(100, d.pct)} className="mt-2 h-1.5" />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {d.kind === "meta" ? "Ahorrado" : "Abonado"} {formatCOP(d.paid)} de{" "}
                    {formatCOP(d.kind === "meta" ? d.target_amount : d.total_amount)}
                  </div>
                  {d.breakdown.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {d.breakdown.map((b: any) => (
                        <div key={b.user_id} className="flex flex-wrap justify-between gap-1 text-[11px]">
                          <span className="min-w-0 truncate">{nameOf(b.user_id)}</span>
                          <span className="text-muted-foreground">
                            {formatCOP(b.paid)} / {formatCOP(b.assigned)} ·{" "}
                            <b className={b.pending === 0 ? "text-success" : "text-foreground"}>
                              {b.pending === 0 ? "al día" : `faltan ${formatCOP(b.pending)}`}
                            </b>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
