import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/currency";
import { History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({ meta: [{ title: "Historial — HogarFin" }, { name: "description", content: "Registro de actividad familiar." }] }),
  component: Historial,
});

function Historial() {
  const [log, setLog] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("*"),
      ]);
      setLog(l ?? []);
      setProfiles(p ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-muted-foreground">Últimos 100 movimientos.</p>
      </div>

      {log.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin actividad todavía.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {log.map((e) => {
                const who = profiles.find((p) => p.id === e.user_id)?.name ?? "Sistema";
                return (
                  <li key={e.id} className="flex items-center gap-3 p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-accent">
                      <History className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm"><b>{who}</b> · {e.action} <span className="text-muted-foreground">({e.entity})</span></div>
                      <div className="text-xs text-muted-foreground">{formatDate(e.created_at)}</div>
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