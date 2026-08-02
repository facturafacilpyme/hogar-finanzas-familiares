export interface DebtLike { id: string; total_amount: number | string; due_date?: string | null }

export type DebtStatus = "pagada" | "mora" | "por_vencer" | "activa";

export const STATUS_META: Record<DebtStatus, { label: string; cls: string }> = {
  pagada: { label: "Pagada", cls: "bg-success/15 text-success" },
  mora: { label: "En mora", cls: "bg-destructive/15 text-destructive" },
  por_vencer: { label: "Por vencer", cls: "bg-warning/30 text-warning-foreground" },
  activa: { label: "Al día", cls: "bg-primary/10 text-primary" },
};

export function sum(rows: any[], field = "amount") {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
}

/** Días restantes hasta la fecha (null si no hay fecha). */
function days(due?: string | null): number | null {
  if (!due) return null;
  const t = new Date(due);
  t.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

export function debtStatus(debt: DebtLike, payments: any[]): DebtStatus {
  const paid = sum(payments);
  const remaining = Number(debt.total_amount) - paid;
  if (remaining <= 0.5) return "pagada";
  const d = days(debt.due_date);
  if (d !== null && d < 0) return "mora";
  if (d !== null && d <= 3) return "por_vencer";
  return "activa";
}

/** Abonado / pendiente por cada responsable de la deuda. */
export function memberBreakdown(members: any[], payments: any[]) {
  return members.map((m) => {
    const paid = sum(payments.filter((p) => p.user_id === m.user_id));
    const assigned = Number(m.amount_assigned ?? 0);
    return {
      ...m,
      assigned,
      paid,
      pending: Math.max(0, assigned - paid),
      pct: assigned > 0 ? Math.min(100, (paid / assigned) * 100) : paid > 0 ? 100 : 0,
    };
  });
}
