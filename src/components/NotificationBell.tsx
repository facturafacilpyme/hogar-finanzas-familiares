import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
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
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

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

  return (
    <Popover>
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
            items.map((n) => (
              <div key={n.id} className={`border-b p-3 text-sm ${!n.read ? "bg-accent/40" : ""}`}>
                <div>{n.message}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDate(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}