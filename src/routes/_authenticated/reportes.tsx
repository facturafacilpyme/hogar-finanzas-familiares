import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — HogarFin" },
      { name: "description", content: "Reportes financieros de la familia: deudas, abonos, gastos y ahorros exportables." },
      { property: "og:title", content: "Reportes — HogarFin" },
      { property: "og:description", content: "Reportes financieros de la familia: deudas, abonos, gastos y ahorros exportables." },
    ],
  }),
  component: Reportes,
});

const COLORS = ["oklch(0.62 0.16 155)", "oklch(0.78 0.16 78)", "oklch(0.65 0.2 25)", "oklch(0.55 0.15 260)", "oklch(0.7 0.14 190)", "oklch(0.7 0.16 30)", "oklch(0.5 0.1 300)"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Reportes() {
  const { familyId, familyName } = useAuth();
  const [data, setData] = useState<any>({ debts: [], dm: [], pays: [], exp: [], goals: [], contrib: [], profiles: [] });

  useEffect(() => {
    (async () => {
      if (!familyId) return;
      const [{ data: debts }, { data: dm }, { data: pays }, { data: exp }, { data: goals }, { data: contrib }, { data: fm }] =
        await Promise.all([
          supabase.from("debts").select("*").eq("family_id", familyId),
          supabase.from("debt_members").select("*").eq("family_id", familyId),
          supabase.from("payments").select("*").eq("family_id", familyId),
          supabase.from("expenses").select("*").eq("family_id", familyId),
          supabase.from("savings_goals").select("*").eq("family_id", familyId),
          supabase.from("savings_contributions").select("*").eq("family_id", familyId),
          supabase.from("family_members").select("user_id").eq("family_id", familyId),
        ]);
      const ids = (fm ?? []).map((x: any) => x.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, name, email").in("id", ids)
        : { data: [] as any[] };
      setData({ debts: debts ?? [], dm: dm ?? [], pays: pays ?? [], exp: exp ?? [], goals: goals ?? [], contrib: contrib ?? [], profiles: profiles ?? [] });
    })();
  }, [familyId]);

  const nameOf = (id: string) => data.profiles.find((p: any) => p.id === id)?.name ?? "?";

  const totales = useMemo(() => {
    const deuda = data.debts.reduce((s: number, d: any) => s + Number(d.total_amount), 0);
    const abonado = data.pays.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const gastos = data.exp.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const ahorrado = data.goals.reduce((s: number, g: any) => s + Number(g.current_amount), 0);
    const metas = data.goals.reduce((s: number, g: any) => s + Number(g.target_amount), 0);
    return { deuda, abonado, pendiente: Math.max(0, deuda - abonado), gastos, ahorrado, metas };
  }, [data]);

  const gastosPorCat = useMemo(() => {
    const m = new Map<string, number>();
    data.exp.forEach((x: any) => m.set(x.category, (m.get(x.category) ?? 0) + Number(x.amount)));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [data]);

  const deudaPorMiembro = useMemo(() => {
    const asignado = new Map<string, number>();
    const abonado = new Map<string, number>();
    data.dm.forEach((r: any) => asignado.set(r.user_id, (asignado.get(r.user_id) ?? 0) + Number(r.amount_assigned)));
    data.pays.forEach((p: any) => abonado.set(p.user_id, (abonado.get(p.user_id) ?? 0) + Number(p.amount)));
    const ids = new Set<string>([...asignado.keys(), ...abonado.keys()]);
    return [...ids].map((uid) => ({
      name: nameOf(uid),
      Asignado: asignado.get(uid) ?? 0,
      Abonado: abonado.get(uid) ?? 0,
    }));
  }, [data]);

  const serieMensual = useMemo(() => {
    const out: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const inMonth = (val?: string | null) => {
        if (!val) return false;
        const x = new Date(val);
        return `${x.getFullYear()}-${x.getMonth()}` === k;
      };
      out.push({
        name: MESES[d.getMonth()],
        Abonos: data.pays.filter((p: any) => inMonth(p.payment_date)).reduce((s: number, p: any) => s + Number(p.amount), 0),
        Gastos: data.exp.filter((e: any) => inMonth(e.expense_date)).reduce((s: number, e: any) => s + Number(e.amount), 0),
        Ahorro: data.contrib
          .filter((c: any) => inMonth(c.contribution_date) && c.kind !== "retiro")
          .reduce((s: number, c: any) => s + Number(c.amount), 0),
      });
    }
    return out;
  }, [data]);

  const metasProgreso = useMemo(
    () => data.goals.map((g: any) => ({ name: g.name, Ahorrado: Number(g.current_amount), Meta: Number(g.target_amount) })),
    [data],
  );

  const aportesPorMiembro = useMemo(() => {
    const m = new Map<string, number>();
    data.contrib.forEach((c: any) =>
      m.set(c.user_id, (m.get(c.user_id) ?? 0) + (c.kind === "retiro" ? -Number(c.amount) : Number(c.amount))),
    );
    return [...m.entries()].map(([uid, value]) => ({ name: nameOf(uid), value: Math.max(0, value) }));
  }, [data]);

  const estados = useMemo(() => {
    const m = new Map<string, number>();
    data.debts.forEach((d: any) => m.set(d.status, (m.get(d.status) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [data]);

  function exportar(tipo: string) {
    const f = (familyName ?? "familia").replace(/\s+/g, "-").toLowerCase();
    if (tipo === "deudas")
      downloadCSV(`deudas-${f}.csv`, data.debts.map((d: any) => ({
        Deuda: d.name, Entidad: d.entity, Total: d.total_amount, Estado: d.status, Vence: d.due_date ?? "",
      })));
    if (tipo === "abonos")
      downloadCSV(`abonos-${f}.csv`, data.pays.map((p: any) => ({
        Fecha: formatDate(p.payment_date), Persona: nameOf(p.user_id),
        Deuda: data.debts.find((d: any) => d.id === p.debt_id)?.name ?? "", Monto: p.amount, Nota: p.notes ?? "",
      })));
    if (tipo === "gastos")
      downloadCSV(`gastos-${f}.csv`, data.exp.map((e: any) => ({
        Fecha: formatDate(e.expense_date), Categoria: e.category, Descripcion: e.description ?? "",
        Persona: nameOf(e.paid_by), Monto: e.amount,
      })));
    if (tipo === "ahorros")
      downloadCSV(`ahorros-${f}.csv`, data.contrib.map((c: any) => ({
        Fecha: formatDate(c.contribution_date), Meta: data.goals.find((g: any) => g.id === c.goal_id)?.name ?? "",
        Persona: nameOf(c.user_id), Tipo: c.kind, Monto: c.amount,
      })));
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis financiero de {familyName ?? "tu hogar"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["deudas", "abonos", "gastos", "ahorros"].map((t) => (
            <Button key={t} size="sm" variant="outline" onClick={() => exportar(t)}>
              <Download className="mr-1 h-4 w-4" /> <span className="capitalize">{t}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Kpi label="Deuda total" value={formatCOP(totales.deuda)} />
        <Kpi label="Abonado" value={formatCOP(totales.abonado)} />
        <Kpi label="Pendiente" value={formatCOP(totales.pendiente)} />
        <Kpi label="Gastos caja menor" value={formatCOP(totales.gastos)} />
        <Kpi label="Ahorrado" value={formatCOP(totales.ahorrado)} />
        <Kpi label="Metas" value={formatCOP(totales.metas)} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartCard title="Gastos por categoría" empty={gastosPorCat.length === 0}>
          <PieChart>
            <Pie data={gastosPorCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%">
              {gastosPorCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Deuda asignada vs abonada por miembro" empty={deudaPorMiembro.length === 0}>
          <BarChart data={deudaPorMiembro}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" fontSize={11} interval={0} />
            <YAxis fontSize={11} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Asignado" fill={COLORS[3]} radius={[6, 6, 0, 0]} />
            <Bar dataKey="Abonado" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Últimos 6 meses" empty={serieMensual.length === 0}>
          <LineChart data={serieMensual}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Abonos" stroke={COLORS[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Gastos" stroke={COLORS[2]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Ahorro" stroke={COLORS[1]} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Progreso de metas de ahorro" empty={metasProgreso.length === 0}>
          <BarChart data={metasProgreso} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" fontSize={11} width={90} />
            <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Ahorrado" fill={COLORS[0]} radius={[0, 6, 6, 0]} />
            <Bar dataKey="Meta" fill={COLORS[4]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Aportes de ahorro por miembro" empty={aportesPorMiembro.length === 0}>
          <BarChart data={aportesPorMiembro}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" fontSize={11} interval={0} />
            <YAxis fontSize={11} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
            <Bar dataKey="value" name="Aportado" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Deudas por estado" empty={estados.length === 0}>
          <PieChart>
            <Pie data={estados} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="70%">
              {estados.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: any }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="px-2 pb-4">
        <div className="h-64 w-full min-w-0">
          {empty ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}