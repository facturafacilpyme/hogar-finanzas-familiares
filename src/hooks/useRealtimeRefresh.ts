import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "debts",
  "debt_members",
  "payments",
  "savings_goals",
  "savings_goal_members",
  "savings_contributions",
  "expenses",
] as const;

/**
 * Se suscribe a los cambios de las tablas financieras de la familia y ejecuta
 * `onChange` (con un pequeño debounce) para mantener las vistas actualizadas en vivo.
 */
export function useRealtimeRefresh(familyId: string | null | undefined, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!familyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    };

    const channel = supabase.channel(`familia-${familyId}`);
    TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, ping);
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [familyId]);
}
