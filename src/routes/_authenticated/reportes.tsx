import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/currency";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({ meta: [{ title: "Reportes — HogarFin" }, { name: "description", content: "Reportes y análisis financiero." }] }),
  component: Reportes,
});

const COLORS = ["oklch(0.62 0.16 155)", "oklch(0.78 0.16 78)", "oklch(0.65 0.2 25)", "oklch(0.55 0.15 260)", "oklch(0.7 0.14 190)", "oklch(0.7 0.16 30)", "oklch(0.5 0.1 300)"];

function Reportes() {
  const { familyId } = useAuth();
  const [expensesByCat, setExpensesByCat] = useState<any[]>([]);
  const [debtsByMember, setDebtsByMember] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!familyId) return;
      const [{ data: exp }, { data: dm }, { data: profiles }] = await Promise.all([
        supabase.from("expenses").select("category, amount").eq("family_id", familyId),
        supabase.from("debt_members").select("user_id, amount_assigned").eq("family_id", familyId),
        supabase.from("profiles").select("id, name"),
      ]);
      const catMap = new Map<string, number>();
      (exp ?? []).forEach((x: any) => catMap.set(x.category, (catMap.get(x.category) ?? 0) + Number(x.amount)));
      setExpensesByCat([...catMap.entries()].map(([name, value]) => ({ name, value })));

      const memMap = new Map<string, number>();
      (dm ?? []).forEach((r: any) => memMap.set(r.user_id, (memMap.get(r.user_id) ?? 0) + Number(r.amount_assigned)));
      setDebtsByMember([...memMap.entries()].map(([uid, value]) => ({
        name: (profiles ?? []).find((p: any) => p.id === uid)?.name ?? "?",
        value,
      })));
    })();
  }, [familyId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Distribución de gastos y deudas.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Gastos por categoría</CardTitle></CardHeader>
          <CardContent className="h-72">
            {expensesByCat.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensesByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {expensesByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Deuda asignada por miembro</CardTitle></CardHeader>
          <CardContent className="h-72">
            {debtsByMember.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={debtsByMember}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
                  <Bar dataKey="value" fill="oklch(0.62 0.16 155)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}