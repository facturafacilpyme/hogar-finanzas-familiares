import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, PiggyBank, Wallet } from "lucide-react";
import { formatCOP, formatDate, daysUntil } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { mensajeAhorro, mensajeDeuda } from "@/lib/whatsapp";

const SNOOZE_KEY = "hogarfin_reminder_snooze";
const SNOOZE_MS = 4 * 60 * 60 * 1000; // 4 horas

type Item = {
  kind: "deuda" | "meta" | "comprobante";
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  urgency: "alta" | "media";
  phone?: string | null;
  message: string;
};

function snoozed() {
  try {
    return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    return false;
  }
}

function snooze(ms = SNOOZE_MS) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {}
}

async function pushNotification(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  try {
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "/favicon.ico", tag: "hogarfin-recordatorio" });
    else new Notification(title, { body, icon: "/favicon.ico" });
  } catch {}
}

/** Recordatorios emergentes (pop-up + notificación del sistema) para toda la familia. */
export function ReminderPopup() {
  const { user, role, familyId, familyName } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!familyId || !user) return;
    const [{ data: debts }, { data: dm }, { data: pays }, { data: goals }, { data: gm }, { data: fm }] = await Promise.all([
      supabase.from("debts").select("*").eq("family_id", familyId),
      supabase.from("debt_members").select("*").eq("family_id", familyId),
      supabase.from("payments").select("amount, user_id, debt_id").eq("family_id", familyId),
      supabase.from("savings_goals").select("*").eq("family_id", familyId),
      supabase.from("savings_goal_members").select("*").eq("family_id", familyId),
      supabase.from("family_members").select("user_id").eq("family_id", familyId),
    ]);
    const ids = (fm ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, phone").in("id", ids)
      : { data: [] as any[] };
    const nameOf = (id: string) => (profs ?? []).find((p: any) => p.id === id)?.name ?? "—";
    const phoneOf = (id: string) => (profs ?? []).find((p: any) => p.id === id)?.phone ?? null;
    const isAdmin = role === "admin";

    const out: Item[] = [];

    (debts ?? []).forEach((d: any) => {
      const abonado = (pays ?? []).filter((p: any) => p.debt_id === d.id).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const pendiente = Number(d.total_amount) - abonado;
      const dias = daysUntil(d.due_date);
      if (pendiente > 0.5 && dias !== null && dias <= 3) {
        const filas = (dm ?? []).filter((m: any) => m.debt_id === d.id);
        const mias = filas.filter((m: any) => m.user_id === user.id);
        const objetivo = isAdmin ? filas : mias;
        objetivo.forEach((m: any) => {
          const pagado = (pays ?? [])
            .filter((p: any) => p.debt_id === d.id && p.user_id === m.user_id)
            .reduce((s: number, p: any) => s + Number(p.amount), 0);
          const falta = Math.max(0, Number(m.amount_assigned ?? 0) - pagado);
          if (falta <= 0.5) return;
          out.push({
            kind: "deuda",
            id: `${d.id}-${m.user_id}`,
            title: d.name,
            subtitle: `${m.user_id === user.id ? "Tu parte" : nameOf(m.user_id)} · ${d.entity ?? ""} · ${
              dias < 0 ? `en mora hace ${Math.abs(dias)} día(s)` : dias === 0 ? "vence hoy" : `vence en ${dias} día(s)`
            } (${formatDate(d.due_date)})`,
            amount: falta,
            urgency: dias < 0 ? "alta" : "media",
            phone: phoneOf(m.user_id),
            message: mensajeDeuda({
              nombre: nameOf(m.user_id),
              deuda: d.name,
              entidad: d.entity,
              pendiente: falta,
              vence: d.due_date,
              dias,
              status: dias < 0 ? "mora" : "por_vencer",
              familia: familyName,
            }),
          });
        });
        if (objetivo.length === 0 && isAdmin) {
          out.push({
            kind: "deuda",
            id: d.id,
            title: d.name,
            subtitle: `${d.entity ?? ""} · ${dias < 0 ? `en mora hace ${Math.abs(dias)} día(s)` : dias === 0 ? "vence hoy" : `vence en ${dias} día(s)`}`,
            amount: pendiente,
            urgency: dias < 0 ? "alta" : "media",
            message: "",
          });
        }
      }
      if (isAdmin && d.settlement_due_at && !d.settlement_proof_url) {
        out.push({
          kind: "comprobante",
          id: `c-${d.id}`,
          title: `Falta el comprobante de "${d.name}"`,
          subtitle: `Plazo hasta ${formatDate(d.settlement_due_at)}. Es obligatorio subir el pago total de la factura.`,
          amount: 0,
          urgency: "alta",
          message: "",
        });
      }
    });

    (goals ?? []).forEach((g: any) => {
      const restante = Number(g.target_amount) - Number(g.current_amount);
      if (restante <= 0.5) return;
      const dias = daysUntil(g.due_date);
      if (dias !== null && dias > 30) return;
      const asignados = (gm ?? []).filter((m: any) => m.goal_id === g.id).map((m: any) => m.user_id);
      if (!role) return;
      const soyResponsable = asignados.includes(user.id);
      if (!soyResponsable && role !== "admin") return;
      const cuota = asignados.length ? restante / asignados.length : restante;
      out.push({
        kind: "meta",
        id: `g-${g.id}`,
        title: g.name,
        subtitle: dias !== null
          ? `Faltan ${formatCOP(restante)} y ${dias} día(s) para la fecha meta`
          : `Faltan ${formatCOP(restante)} para completar la meta`,
        amount: cuota,
        urgency: dias !== null && dias <= 7 ? "alta" : "media",
        phone: phoneOf(user.id),
        message: mensajeAhorro({
          nombre: nameOf(user.id),
          meta: g.name,
          aportado: 0,
          cuota,
          restante,
          porDia: dias && dias > 0 ? cuota / dias : null,
          dias,
          familia: familyName,
          seed: g.name.length,
        }),
      });
    });

    out.sort((a, b) => (a.urgency === b.urgency ? b.amount - a.amount : a.urgency === "alta" ? -1 : 1));
    setItems(out.slice(0, 8));
  }, [familyId, user, role, familyName]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  useEffect(() => {
    if (items.length === 0 || snoozed()) return;
    const t = setTimeout(() => {
      setOpen(true);
      const first = items[0];
      pushNotification(
        items.some((i) => i.urgency === "alta") ? "⚠️ HogarFin: tienes pendientes urgentes" : "🔔 HogarFin: recordatorio",
        `${first.title} · ${first.subtitle}`,
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [items]);

  // Vuelve a recordar cada 4 horas con la app abierta.
  useEffect(() => {
    const i = setInterval(() => {
      if (!snoozed() && items.length > 0) setOpen(true);
    }, SNOOZE_MS);
    return () => clearInterval(i);
  }, [items]);

  const alta = items.some((i) => i.urgency === "alta");

  return (
    <Dialog open={open && items.length > 0} onOpenChange={(o) => { if (!o) { snooze(); setOpen(false); } }}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 break-words">
            {alta ? <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /> : <Bell className="h-5 w-5 shrink-0 text-primary" />}
            {alta ? "Tienes pendientes urgentes" : "Recordatorio de tu hogar"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {role === "admin"
            ? "Revisa lo que está por vencer y coordina con la familia hoy mismo."
            : role === "invitado"
              ? "Así va el hogar hoy. Estás como invitado: puedes ver todo el detalle."
              : "Esto es lo que te corresponde. Un abono o aporte hoy evita recargos y te acerca a la meta."}
        </p>

        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded-lg border p-3 text-sm ${it.urgency === "alta" ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"}`}
            >
              <div className="flex items-start gap-2">
                {it.kind === "meta" ? <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{it.title}</div>
                  <div className="break-words text-xs text-muted-foreground">{it.subtitle}</div>
                  {it.amount > 0 && (
                    <div className="mt-1 text-xs font-semibold">
                      {it.kind === "meta" ? "Aporte sugerido: " : "Pendiente: "}
                      {formatCOP(it.amount)}
                    </div>
                  )}
                </div>
              </div>
              {it.message && it.phone && (
                <div className="mt-2 flex justify-end">
                  <WhatsAppButton phone={it.phone} message={it.message} label="Avisar por WhatsApp" className="h-7 px-2 text-[11px]" variant="ghost" />
                </div>
              )}
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => { snooze(); setOpen(false); }}>Recordarme más tarde</Button>
          <Button asChild onClick={() => { snooze(); setOpen(false); }}>
            {items[0]?.kind === "meta" ? (
              <Link to="/ahorros" search={{ goalId: undefined }}>Ver y resolver ahora</Link>
            ) : (
              <Link to="/deudas" search={{ debtId: undefined }}>Ver y resolver ahora</Link>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
