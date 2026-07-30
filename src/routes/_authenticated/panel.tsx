import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, PiggyBank, TrendingUp, AlertCircle } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — HogarFin" }, { name: "description", content: "Resumen financiero familiar." }] }),
  component: Panel,
});

function Panel() {
  const { profile, role, familyId, familyName } = useAuth();
  const [stats, setStats] = useState({ totalDebt: 0, totalSaved: 0, active: 0 });
  const [upcoming, setUpcoming] = useState<Array<{ id: string; name: string; entity: string; due_date: string }>>([]);

  useEffect(() => {
    (async () => {
      if (!familyId) return;
      const [{ data: debts }, { data: goals }, { data: pays }] = await Promise.all([
        supabase.from("debts").select("*").eq("family_id", familyId),
        supabase.from("savings_goals").select("current_amount").eq("family_id", familyId),
        supabase.from("payments").select("debt_id, amount").eq("family_id", familyId),
      ]);
      const totalDebt = (debts ?? []).reduce((s, d) => s + Number(d.total_amount), 0);
      const totalPaid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const totalSaved = (goals ?? []).reduce((s, g) => s + Number(g.current_amount), 0);
      const active = (debts ?? []).filter((d) => d.status !== "pagada").length;
      setStats({ totalDebt: Math.max(0, totalDebt - totalPaid), totalSaved, active });
      setUpcoming(
        ((debts ?? []) as any[])
          .filter((d) => d.due_date && d.status !== "pagada")
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 5),
      );
    })();
  }, [familyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile?.name} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de {familyName ?? "tu hogar"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Wallet} label="Deuda pendiente" value={formatCOP(stats.totalDebt)} tone="primary" />
        <StatCard icon={PiggyBank} label="Total ahorrado" value={formatCOP(stats.totalSaved)} tone="success" />
        <StatCard icon={TrendingUp} label="Deudas activas" value={String(stats.active)} tone="warning" />
      </div>

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
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.entity} · {formatDate(d.due_date)}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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

      {role === "invitado" && (
        <div className="rounded-xl border bg-accent/40 p-4 text-sm text-accent-foreground">
          Estás como <b>invitado</b>: puedes ver todo, pero no registrar cambios.
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "success" | "warning" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/30 text-warning-foreground",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}