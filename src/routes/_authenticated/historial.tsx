import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCOP, formatDate } from "@/lib/currency";
import { ProofLink } from "@/components/ProofLink";
import { History, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Historial — HogarFin" },
      { name: "description", content: "Registro completo de la actividad financiera de la familia." },
      { property: "og:title", content: "Historial — HogarFin" },
      { property: "og:description", content: "Registro completo de la actividad financiera de la familia." },
    ],
  }),
  component: Historial,
});

const ENTIDADES: Record<string, string> = {
  debts: "Deuda",
  debt_members: "Reparto de deuda",
  payments: "Abono",
  expenses: "Gasto",
  savings_goals: "Meta de ahorro",
  savings_contributions: "Aporte de ahorro",
  savings_goal_members: "Responsable de meta",
  family_members: "Miembro",
  families: "Familia",
  invitations: "Invitación",
};

const ACCIONES: Record<string, string> = {
  insert: "creó",
  update: "actualizó",
  delete: "eliminó",
};

function Historial() {
  const { familyId } = useAuth();
  const [log, setLog] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");

  useEffect(() => {
    (async () => {
      if (!familyId) return;
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("activity_log").select("*").eq("family_id", familyId).order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, name"),
      ]);
      setLog(l ?? []);
      setProfiles(p ?? []);
    })();
  }, [familyId]);

  const nameOf = (id?: string | null) => profiles.find((p) => p.id === id)?.name ?? "Sistema";

  function describe(e: any) {
    const d = (e.details ?? {}) as any;
    const partes: string[] = [];
    if (d.name) partes.push(String(d.name));
    if (d.category) partes.push(String(d.category));
    if (d.amount != null) partes.push(formatCOP(d.amount));
    if (d.total_amount != null) partes.push(formatCOP(d.total_amount));
    if (d.target_amount != null) partes.push(`meta ${formatCOP(d.target_amount)}`);
    if (d.amount_assigned != null) partes.push(`asignado ${formatCOP(d.amount_assigned)}`);
    if (d.role) partes.push(`rol ${d.role}`);
    if (d.user_id && d.user_id !== e.user_id) partes.push(`a ${nameOf(d.user_id)}`);
    if (d.kind === "retiro") partes.push("retiro");
    return partes.join(" · ");
  }

  const filtered = useMemo(
    () =>
      log.filter((e) => {
        if (tipo !== "todos" && e.entity !== tipo) return false;
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return (
          (ENTIDADES[e.entity] ?? e.entity).toLowerCase().includes(t) ||
          nameOf(e.user_id).toLowerCase().includes(t) ||
          describe(e).toLowerCase().includes(t)
        );
      }),
    [log, tipo, q, profiles],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-muted-foreground">Todos los movimientos de la familia ({log.length} registros).</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar en el historial…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(ENTIDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin actividad todavía.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((e) => {
                const d = (e.details ?? {}) as any;
                return (
                  <li key={e.id} className="flex items-center gap-3 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent">
                      <History className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <b>{nameOf(e.user_id)}</b> {ACCIONES[e.action] ?? e.action}{" "}
                        <span className="text-muted-foreground">{ENTIDADES[e.entity] ?? e.entity}</span>
                      </div>
                      {describe(e) && <div className="truncate text-xs text-muted-foreground">{describe(e)}</div>}
                      <div className="text-xs text-muted-foreground">{formatDate(e.created_at)}</div>
                    </div>
                    <ProofLink path={d.proof_url} label="Ver" />
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