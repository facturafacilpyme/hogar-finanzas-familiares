import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushQueue, isOffline, onQueueChange } from "@/lib/syncQueue";
import { toast } from "sonner";

/** Indicador de conexión y de operaciones pendientes de sincronizar. */
export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(isOffline());
    const off = onQueueChange(setPending);
    const sync = async () => {
      setOffline(false);
      const n = await flushQueue();
      if (n > 0) toast.success(`Se sincronizaron ${n} cambio(s) pendientes`);
    };
    const down = () => setOffline(true);
    window.addEventListener("online", sync);
    window.addEventListener("offline", down);
    const timer = setInterval(() => { if (!isOffline()) flushQueue(); }, 30000);
    flushQueue();
    return () => {
      off();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", down);
      clearInterval(timer);
    };
  }, []);

  if (!offline && pending === 0) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const n = await flushQueue();
        toast[n > 0 ? "success" : "info"](n > 0 ? `${n} cambio(s) sincronizados` : "Sin conexión todavía");
      }}
      className="flex items-center gap-1 rounded-full bg-warning/25 px-2 py-1 text-[11px] font-medium text-warning-foreground"
      title="Hay cambios guardados en este dispositivo esperando conexión"
    >
      {offline ? <CloudOff className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{offline ? "Sin conexión" : "Sincronizando"}</span>
      {pending > 0 && <span>· {pending}</span>}
    </button>
  );
}
