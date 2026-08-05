import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, PiggyBank, TrendingUp, AlertCircle, Receipt, HandCoins, Target, Users, AlertTriangle, CalendarRange, Share2, ShieldAlert } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { mensajeDeuda, mensajeResumenPersona, mensajeResumenSemanal, compartirWhatsApp } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { nivelRiesgo, RIESGO_META } from "@/lib/strategy";
import { Progress } from "@/components/ui/progress";

/** Lunes 00:00 y domingo 23:59 de la semana en curso. */
function rangoSemana(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  const desde = new Date(d);
  desde.setDate(d.getDate() - dow);
  const hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 6);
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — HogarFin" }, { name: "description", content: "Resumen financiero familiar." }] }),
  component: Panel,
});

function Panel() {
  const { profile, role, familyId, familyName } = useAuth();
  const [stats, setStats] = useState({
    totalDebt: 0, totalSaved: 0, active: 0, gastosMes: 0, gastosTotal: 0, abonosMes: 0, aportesMes: 0,
  });
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [porPersona, setPorPersona] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [semana, setSemana] = useState<any>(null);

  const load = useCallback(async () => {
      if (!familyId) return;
      const [{ data: debts }, { data: gl }, { data: pays }, { data: exp }, { data: contrib }, { data: dm }, { data: fmembers }] = await Promise.all([
        supabase.from("debts").select("*").eq("family_id", familyId),
        supabase.from("savings_goals").select("*").eq("family_id", familyId),
        supabase.from("payments").select("amount, payment_date, user_id, debt_id").eq("family_id", familyId),
        supabase.from("expenses").select("amount, expense_date").eq("family_id", familyId),
        supabase.from("savings_contributions").select("amount, kind, contribution_date").eq("family_id", familyId),
        supabase.from("debt_members").select("*").eq("family_id", familyId),
        supabase.from("family_members").select("user_id").eq("family_id", familyId),
      ]);
      const ids = (fmembers ?? []).map((x: any) => x.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, name, phone").in("id", ids)
        : { data: [] as any[] };
      const now = new Date();
      const mes = (d?: string | null) =>
        !!d && new Date(d).getMonth() === now.getMonth() && new Date(d).getFullYear() === now.getFullYear();

      const totalDebt = (debts ?? []).reduce((s, d: any) => s + Number(d.total_amount), 0);
      const totalPaid = (pays ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
      const totalSaved = (gl ?? []).reduce((s, g: any) => s + Number(g.current_amount), 0);

      setStats({
        totalDebt: Math.max(0, totalDebt - totalPaid),
        totalSaved,
        active: (debts ?? []).filter((d: any) => d.status !== "pagada").length,
        gastosMes: (exp ?? []).filter((e: any) => mes(e.expense_date)).reduce((s, e: any) => s + Number(e.amount), 0),
        gastosTotal: (exp ?? []).reduce((s, e: any) => s + Number(e.amount), 0),
        abonosMes: (pays ?? []).filter((p: any) => mes(p.payment_date)).reduce((s, p: any) => s + Number(p.amount), 0),
        aportesMes: (contrib ?? [])
          .filter((c: any) => mes(c.contribution_date) && c.kind !== "retiro")
          .reduce((s, c: any) => s + Number(c.amount), 0),
      });

      setUpcoming(
        ((debts ?? []) as any[])
          .filter((d) => d.due_date && d.status !== "pagada")
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 5),
      );
      setGoals(
        ((gl ?? []) as any[])
          .filter((g) => Number(g.current_amount) < Number(g.target_amount))
          .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
          .slice(0, 4),
      );

      // Deuda pendiente asignada a cada persona
      const debtById = new Map((debts ?? []).map((d: any) => [d.id, d]));
      const resumen = (profs ?? []).map((p: any) => {
        const filas = (dm ?? [])
          .filter((m: any) => m.user_id === p.id)
          .map((m: any) => {
            const d: any = debtById.get(m.debt_id);
            const abonado = (pays ?? [])
              .filter((x: any) => x.debt_id === m.debt_id && x.user_id === p.id)
              .reduce((s: number, x: any) => s + Number(x.amount), 0);
            const assigned = Number(m.amount_assigned ?? 0);
            return {
              name: d?.name ?? "Deuda",
              entity: d?.entity ?? null,
              due_date: d?.due_date ?? null,
              assigned,
              paid: abonado,
              pending: Math.max(0, assigned - abonado),
            };
          })
          .filter((r: any) => r.assigned > 0);
        const asignado = filas.reduce((s: number, r: any) => s + r.assigned, 0);
        const abonado = filas.reduce((s: number, r: any) => s + r.paid, 0);
        const pendiente = filas.reduce((s: number, r: any) => s + r.pending, 0);
        return { ...p, filas, asignado, abonado, pendiente };
      }).filter((p: any) => p.asignado > 0)
        .sort((a: any, b: any) => b.pendiente - a.pendiente);
      setPorPersona(resumen);

      // Alertas predictivas de mora: deudas en mora o que vencen dentro de 5 días
      const urgentes = (debts ?? [])
        .map((d: any) => {
          const abonado = (pays ?? []).filter((x: any) => x.debt_id === d.id).reduce((s: number, x: any) => s + Number(x.amount), 0);
          const pendiente = Number(d.total_amount) - abonado;
          const dias = daysUntil(d.due_date);
          return { debt: d, pendiente, dias, riesgo: nivelRiesgo(dias, pendiente) };
        })
        .filter((x: any) => x.pendiente > 0.5 && x.dias !== null && x.dias <= 5)
        .sort((a: any, b: any) => (a.dias ?? 0) - (b.dias ?? 0));
      setAlertas(urgentes);

      // Balance semanal
      const { desde, hasta } = rangoSemana();
      const enSemana = (v?: string | null) => {
        if (!v) return false;
        const t = new Date(v).getTime();
        return t >= desde.getTime() && t <= hasta.getTime();
      };
      setSemana({
        desde,
        hasta,
        deudaPendiente: Math.max(0, totalDebt - totalPaid),
        abonosSemana: (pays ?? []).filter((p: any) => enSemana(p.payment_date)).reduce((s: number, p: any) => s + Number(p.amount), 0),
        ahorroTotal: totalSaved,
        aportesSemana: (contrib ?? [])
          .filter((c: any) => enSemana(c.contribution_date) && c.kind !== "retiro")
          .reduce((s: number, c: any) => s + Number(c.amount), 0),
        gastosSemana: (exp ?? []).filter((e: any) => enSemana(e.expense_date)).reduce((s: number, e: any) => s + Number(e.amount), 0),
        proximos: (debts ?? [])
          .filter((d: any) => d.due_date && enSemana(d.due_date))
          .map((d: any) => {
            const abonado = (pays ?? []).filter((x: any) => x.debt_id === d.id).reduce((s: number, x: any) => s + Number(x.amount), 0);
            return { name: d.name, monto: Math.max(0, Number(d.total_amount) - abonado), due_date: d.due_date };
          })
          .filter((x: any) => x.monto > 0.5)
          .sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date))),
      });
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile?.name} 👋</h1>
        <p className="text-sm text-muted-foreground">Resumen de {familyName ?? "tu hogar"}.</p>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {alertas.some((a) => (a.dias ?? 0) < 0)
              ? "Riesgo de mora: hay deudas vencidas"
              : "Riesgo de mora: pagos próximos a vencer"}
          </div>
          <p className="text-xs text-destructive/90">
            {role === "admin"
              ? "Actúa hoy para evitar intereses y recargos. Puedes avisar por WhatsApp a los responsables."
              : role === "invitado"
                ? "Estas obligaciones del hogar necesitan atención. Como invitado solo puedes consultarlas; avisa al administrador si notas algo."
                : "Revisa si alguna de estas deudas es tuya y registra tu abono hoy para evitar intereses y recargos."}
          </p>
          <ul className="space-y-2">
            {alertas.slice(0, 6).map(({ debt, pendiente, dias, riesgo }) => (
              <li key={debt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/70 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words font-medium">{debt.name}</span>
                    {riesgo && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${RIESGO_META[riesgo as keyof typeof RIESGO_META].cls}`}>
                        {RIESGO_META[riesgo as keyof typeof RIESGO_META].label}
                      </span>
                    )}
                  </div>
                  <div className="break-words text-xs text-muted-foreground">
                    {debt.entity} · {formatCOP(pendiente)} pendiente ·{" "}
                    {dias < 0 ? `en mora hace ${Math.abs(dias)}d` : dias === 0 ? "vence hoy" : `vence en ${dias}d`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to="/deudas" className="text-xs font-semibold text-primary hover:underline">Registrar abono</Link>
                  <Link to="/calendario" className="text-xs font-semibold text-primary hover:underline">Calendario</Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {semana && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4" /> Balance semanal
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  compartirWhatsApp(mensajeResumenSemanal({ familia: familyName, ...semana }))
                }
              >
                <Share2 className="mr-1 h-3.5 w-3.5" /> Compartir
              </Button>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatDate(semana.desde)} — {formatDate(semana.hasta)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MiniStat label="Deuda pendiente" value={formatCOP(semana.deudaPendiente)} tone="text-foreground" />
              <MiniStat label="Abonos de la semana" value={formatCOP(semana.abonosSemana)} tone="text-success" />
              <MiniStat label="Ahorro acumulado" value={formatCOP(semana.ahorroTotal)} tone="text-primary" />
              <MiniStat label="Caja menor semanal" value={formatCOP(semana.gastosSemana)} tone="text-warning-foreground" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Próximos pagos de esta semana</div>
              {semana.proximos.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Sin pagos programados esta semana. 🎉</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {semana.proximos.map((p: any, i: number) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatCOP(p.monto)} · {formatDate(p.due_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Wallet} label="Deuda pendiente" value={formatCOP(stats.totalDebt)} tone="primary" />
        <StatCard icon={HandCoins} label="Abonos este mes" value={formatCOP(stats.abonosMes)} tone="success" />
        <StatCard icon={TrendingUp} label="Deudas activas" value={String(stats.active)} tone="warning" />
        <StatCard icon={PiggyBank} label="Total ahorrado" value={formatCOP(stats.totalSaved)} tone="success" />
        <StatCard icon={Target} label="Aportes este mes" value={formatCOP(stats.aportesMes)} tone="primary" />
        <StatCard
          icon={Receipt}
          label="Gastos este mes"
          value={formatCOP(stats.gastosMes)}
          tone="warning"
          hint={`Histórico: ${formatCOP(stats.gastosTotal)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Deuda pendiente por persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porPersona.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay deudas asignadas a los miembros.</p>
          ) : (
            <ul className="space-y-4">
              {porPersona.map((p) => {
                const pct = p.asignado ? Math.min(100, (p.abonado / p.asignado) * 100) : 0;
                const urgente = p.filas.find((f: any) => {
                  const d = daysUntil(f.due_date);
                  return f.pending > 0 && d !== null && d <= 3;
                });
                return (
                  <li key={p.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-words text-sm font-medium">{p.name}</span>
                      <span className="break-words text-xs text-muted-foreground">
                        {formatCOP(p.abonado)} / {formatCOP(p.asignado)} ·{" "}
                        <b className={p.pendiente === 0 ? "text-success" : "text-foreground"}>
                          {p.pendiente === 0 ? "al día" : `faltan ${formatCOP(p.pendiente)}`}
                        </b>
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1 h-1.5" />
                    {p.pendiente > 0 && (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {p.filas.filter((f: any) => f.pending > 0).length} deuda(s) pendiente(s)
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {urgente && (
                            <WhatsAppButton
                              phone={p.phone}
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              label="Avisar urgencia"
                              message={mensajeDeuda({
                                nombre: p.name,
                                deuda: urgente.name,
                                entidad: urgente.entity,
                                pendiente: urgente.pending,
                                vence: urgente.due_date,
                                dias: daysUntil(urgente.due_date),
                                status: (daysUntil(urgente.due_date) ?? 0) < 0 ? "mora" : "por_vencer",
                                familia: familyName,
                              })}
                            />
                          )}
                          <WhatsAppButton
                            phone={p.phone}
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            label="Enviar resumen"
                            message={mensajeResumenPersona({
                              nombre: p.name,
                              pendienteTotal: p.pendiente,
                              deudas: p.filas.filter((f: any) => f.pending > 0),
                              familia: familyName,
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" /> Próximos pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos próximos.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((d) => {
                  const days = daysUntil(d.due_date);
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-medium">{d.name}</div>
                        <div className="break-words text-xs text-muted-foreground">{d.entity} · {formatDate(d.due_date)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        days !== null && days < 0 ? "bg-destructive/15 text-destructive"
                        : days !== null && days <= 3 ? "bg-warning/30 text-warning-foreground"
                        : "bg-success/15 text-success"
                      }`}>
                        {days !== null && days < 0 ? `En mora ${Math.abs(days)}d` : days === 0 ? "Hoy" : `En ${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4" /> Metas en curso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin metas activas.</p>
            ) : (
              <ul className="divide-y">
                {goals.map((g) => {
                  const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
                  return (
                    <li key={g.id} className="py-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <Link to="/ahorros" className="min-w-0 break-words font-medium hover:underline">{g.name}</Link>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatCOP(g.current_amount)} / {formatCOP(g.target_amount)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {role === "invitado" && (
        <div className="rounded-xl border bg-accent/40 p-4 text-sm text-accent-foreground">
          Estás como <b>invitado</b>: puedes ver todo, pero no registrar cambios.
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, hint }: { icon: any; label: string; value: string; tone: "primary" | "success" | "warning"; hint?: string }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/30 text-warning-foreground",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="break-words text-xl font-bold leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}