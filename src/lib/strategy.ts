import { daysUntil } from "@/lib/currency";

export type Metodo = "avalancha" | "bola_nieve";

export interface DebtInput {
  id: string;
  name: string;
  entity?: string | null;
  total_amount: number | string;
  interest_rate?: number | string | null;
  due_date?: string | null;
  cuota_amount?: number | string | null;
}

export interface PlanPaso {
  orden: number;
  id: string;
  name: string;
  entity?: string | null;
  saldo: number;
  tasa: number;
  due_date?: string | null;
  dias: number | null;
  cuotaSugerida: number;
  mesesEstimados: number | null;
  interesEstimado: number;
  motivo: string;
}

export interface Plan {
  metodo: Metodo;
  pasos: PlanPaso[];
  saldoTotal: number;
  interesTotal: number;
  mesesTotales: number | null;
  resumen: string;
}

/**
 * Construye el plan de desendeudamiento.
 * - Avalancha: primero la deuda con mayor tasa de interés (desempata por saldo mayor). Ahorra más dinero.
 * - Bola de nieve: primero la deuda con menor saldo. Da victorias rápidas y motivación.
 */
export function construirPlan(
  debts: DebtInput[],
  pagosPorDeuda: Record<string, number>,
  metodo: Metodo,
  presupuestoMensual: number,
): Plan {
  const vivas = debts
    .map((d) => {
      const saldo = Math.max(0, Number(d.total_amount) - (pagosPorDeuda[d.id] ?? 0));
      return { d, saldo, tasa: Number(d.interest_rate ?? 0) };
    })
    .filter((x) => x.saldo > 0.5);

  const ordenadas = [...vivas].sort((a, b) => {
    if (metodo === "avalancha") {
      if (b.tasa !== a.tasa) return b.tasa - a.tasa;
      return b.saldo - a.saldo;
    }
    if (a.saldo !== b.saldo) return a.saldo - b.saldo;
    return b.tasa - a.tasa;
  });

  const saldoTotal = ordenadas.reduce((s, x) => s + x.saldo, 0);
  const minimo = ordenadas.reduce((s, x) => s + Math.min(x.saldo, Number(x.d.cuota_amount ?? 0)), 0);
  const disponible = presupuestoMensual > 0 ? presupuestoMensual : Math.max(minimo, saldoTotal / 12);

  let mesAcumulado = 0;
  let interesTotal = 0;

  const pasos: PlanPaso[] = ordenadas.map((x, i) => {
    const extra = i === 0 ? disponible : Math.max(disponible * 0.35, Number(x.d.cuota_amount ?? 0));
    const cuotaSugerida = Math.min(x.saldo, Math.max(extra, x.saldo / 12));
    const meses = cuotaSugerida > 0 ? Math.max(1, Math.ceil(x.saldo / cuotaSugerida)) : null;
    mesAcumulado += meses ?? 0;
    const interesEstimado = x.tasa > 0 && meses ? (x.saldo * (x.tasa / 100) * meses) / 2 : 0;
    interesTotal += interesEstimado;
    return {
      orden: i + 1,
      id: x.d.id,
      name: x.d.name,
      entity: x.d.entity ?? null,
      saldo: x.saldo,
      tasa: x.tasa,
      due_date: x.d.due_date ?? null,
      dias: daysUntil(x.d.due_date),
      cuotaSugerida,
      mesesEstimados: meses,
      interesEstimado,
      motivo:
        i === 0
          ? metodo === "avalancha"
            ? "Ataca primero esta: es la que más intereses te cuesta."
            : "Ataca primero esta: es la más pequeña y la eliminas rápido."
          : metodo === "avalancha"
            ? "Paga el mínimo mientras liberas la anterior; sigue por mayor tasa."
            : "Paga el mínimo y, al liberar la anterior, suma ese valor aquí (efecto bola de nieve).",
    };
  });

  return {
    metodo,
    pasos,
    saldoTotal,
    interesTotal,
    mesesTotales: pasos.length ? mesAcumulado : null,
    resumen:
      metodo === "avalancha"
        ? "Método Avalancha: ordena por la tasa de interés más alta. Es el que menos dinero te cuesta a largo plazo."
        : "Método Bola de Nieve: ordena por el saldo más pequeño. Es el que más motiva porque ves deudas cerradas rápido.",
  };
}

/** Nivel de riesgo de mora de una deuda con saldo pendiente. */
export type Riesgo = "critico" | "alto" | "medio" | "bajo";

export function nivelRiesgo(dias: number | null, saldo: number): Riesgo | null {
  if (saldo <= 0.5 || dias === null) return null;
  if (dias < 0) return "critico";
  if (dias <= 2) return "alto";
  if (dias <= 5) return "medio";
  return "bajo";
}

export const RIESGO_META: Record<Riesgo, { label: string; cls: string; dot: string }> = {
  critico: { label: "En mora", cls: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  alto: { label: "Riesgo alto", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  medio: { label: "Riesgo medio", cls: "bg-warning/30 text-warning-foreground", dot: "bg-warning" },
  bajo: { label: "Bajo control", cls: "bg-success/15 text-success", dot: "bg-success" },
};
