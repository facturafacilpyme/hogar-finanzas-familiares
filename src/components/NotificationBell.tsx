import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { formatDate } from "@/lib/currency";

interface Notif {
  id: string;
  message: string;
  read: boolean;
  type: string;
  related_id: string | null;
  created_at: string;
}

type Accion = { label: string; target: "deudas" | "abonos" | "ahorros" };

const ACCIONES: Record<string, Accion> = {
  nueva_deuda: { label: "Ver deuda", target: "deudas" },
  por_vencer: { label: "Registrar abono", target: "deudas" },
  en_mora: { label: "Registrar abono", target: "deudas" },
  riesgo_mora: { label: "Registrar abono", target: "deudas" },
  pago_total_pendiente: { label: "Subir comprobante", target: "deudas" },
  comprobante_pendiente: { label: "Subir comprobante", target: "deudas" },
  abono_registrado: { label: "Ver abonos", target: "abonos" },
  meta_completada: { label: "Ver meta", target: "ahorros" },
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev]);
          toast(n.message);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("HogarFin", { body: n.message });
          }
        },
      )
      .subscribe();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((i) => !i.read).length;

  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  async function marcarUna(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  async function ejecutar(n: Notif) {
    const accion = ACCIONES[n.type];
    await marcarUna(n.id);
    if (!accion || !n.related_id) {
      setOpen(false);
      toast.info("Esta notificación ya no tiene un registro asociado.");
      return;
    }
    setOpen(false);
    if (accion.target === "ahorros") {
      navigate({ to: "/ahorros", search: { goalId: n.related_id } });
    } else if (accion.target === "abonos") {
      navigate({ to: "/abonos", search: { debtId: n.related_id } });
    } else {
      navigate({ to: "/deudas", search: { debtId: n.related_id } });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">Notificaciones</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-primary hover:underline">
              Marcar leídas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin notificaciones</div>
          ) : (
            items.map((n) => {
              const accion = ACCIONES[n.type];
              return (
                <div key={n.id} className={`border-b p-3 text-sm ${!n.read ? "bg-accent/40" : ""}`}>
                  <div className="break-words">{n.message}</div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => ejecutar(n)}>
                      {accion?.label ?? "Ver detalle"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
