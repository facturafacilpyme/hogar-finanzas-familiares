import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Paginación incremental en cliente: muestra N elementos y carga más al llegar al final. */
export function usePager(pageSize = 15) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  const limitOf = useCallback((k: string) => limits[k] ?? pageSize, [limits, pageSize]);
  const slice = useCallback(
    <T,>(k: string, list: T[], focusIndex = -1) => {
      const lim = Math.max(limitOf(k), focusIndex >= 0 ? Math.ceil((focusIndex + 1) / pageSize) * pageSize : 0);
      return list.slice(0, lim);
    },
    [limitOf, pageSize],
  );
  const more = useCallback((k: string) => setLimits((s) => ({ ...s, [k]: (s[k] ?? pageSize) + pageSize })), [pageSize]);
  return { slice, more, limitOf };
}

export function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown >= total || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && onMore(), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, total, onMore]);
  if (total === 0) return null;
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 py-3 text-xs text-muted-foreground">
      <span>Mostrando {Math.min(shown, total)} de {total}</span>
      {shown < total && <Button variant="outline" size="sm" onClick={onMore}>Ver más</Button>}
    </div>
  );
}
