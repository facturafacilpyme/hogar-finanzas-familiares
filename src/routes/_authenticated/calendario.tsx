import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario — HogarFin" }, { name: "description", content: "Calendario mensual de pagos." }] }),
  component: Calendario,
});

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["D", "L", "M", "X", "J", "V", "S"];

function Calendario() {
  const { familyId } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [ref, setRef] = useState(new Date());

  useEffect(() => {
    if (!familyId) return;
    supabase.from("debts").select("*").eq("family_id", familyId).then(({ data }) => setDebts(data ?? []));
  }, [familyId]);

  const y = ref.getFullYear();
  const m = ref.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const byDay = useMemo(() => {
    const map = new Map<number, any[]>();
    debts.forEach((d) => {
      if (!d.due_date) return;
      const date = new Date(d.due_date);
      if (date.getFullYear() === y && date.getMonth() === m) {
        const day = date.getDate();
        map.set(day, [...(map.get(day) ?? []), d]);
      }
    });
    return map;
  }, [debts, y, m]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setRef(new Date(y, m - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-40 text-center font-semibold">{MESES[m]} {y}</div>
          <Button size="icon" variant="outline" onClick={() => setRef(new Date(y, m + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {DIAS.map((d) => <div key={d} className="p-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((c, i) => (
              <div
                key={i}
                className={`min-h-16 rounded-lg border p-1 text-xs ${c ? "bg-background" : "bg-muted/30"} ${c && isToday(c) ? "ring-2 ring-primary" : ""}`}
              >
                {c && <>
                  <div className="text-right font-semibold">{c}</div>
                  {(byDay.get(c) ?? []).slice(0, 2).map((d) => (
                    <div key={d.id} className="mt-0.5 truncate rounded bg-primary/15 px-1 text-[10px] font-medium text-primary">
                      {d.name}
                    </div>
                  ))}
                  {(byDay.get(c)?.length ?? 0) > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{(byDay.get(c)!.length - 2)} más</div>
                  )}
                </>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Pagos del mes</h2>
        {[...byDay.entries()].sort(([a], [b]) => a - b).map(([day, items]) => (
          <Card key={day}>
            <CardContent className="p-3">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Día {day}</div>
              {items.map((d) => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span>{d.name} · <span className="text-muted-foreground">{d.entity}</span></span>
                  <span className="font-semibold">{formatCOP(d.total_amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}