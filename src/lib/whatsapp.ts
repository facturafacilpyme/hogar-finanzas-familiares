import { formatCOP, formatDate } from "@/lib/currency";

/** Normaliza un teléfono a formato internacional para wa.me (Colombia por defecto). */
export function normalizePhone(raw?: string | null, defaultCode = "57"): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.length === 10) d = defaultCode + d; // celular local
  if (d.length < 10) return null;
  return d;
}

export function waLink(phone: string | null | undefined, message: string): string | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const url = waLink(phone, message);
  if (!url) return false;
  window.open(url, "_blank", "noopener");
  return true;
}

const TIPS_AHORRO = [
  "Aparta el aporte apenas recibas tu pago, antes de gastar.",
  "Usa la regla 50/30/20: necesidades, gustos y ahorro.",
  "Programa una transferencia automática semanal, aunque sea pequeña.",
  "Anota cada gasto por 7 días: verás de dónde sacar el aporte.",
  "Reta a la familia: una semana sin domicilios y ese dinero va a la meta.",
  "Redondea tus compras y guarda la diferencia.",
  "Cancela una suscripción que no uses y destina ese valor a la meta.",
  "Divide la meta en aportes diarios pequeños: es más fácil sostenerlos.",
];

export function tipAhorro(seed = 0) {
  return TIPS_AHORRO[Math.abs(seed) % TIPS_AHORRO.length];
}

export type DebtMsgStatus = "mora" | "por_vencer" | "activa" | "pagada";

export function mensajeDeuda(opts: {
  nombre: string;
  deuda: string;
  entidad?: string | null;
  pendiente: number;
  vence?: string | null;
  dias?: number | null;
  status: DebtMsgStatus;
  familia?: string | null;
}) {
  const { nombre, deuda, entidad, pendiente, vence, dias, status, familia } = opts;
  const cab = `Hola ${nombre} 👋 (HogarFin${familia ? ` · ${familia}` : ""})`;
  const det = `\n\n📄 *${deuda}*${entidad ? ` — ${entidad}` : ""}\n💰 Pendiente tuyo: *${formatCOP(pendiente)}*${vence ? `\n📅 Vence: ${formatDate(vence)}` : ""}`;
  if (status === "mora") {
    return `${cab}${det}\n\n🚨 Esta deuda está *en mora*${dias != null ? ` hace ${Math.abs(dias)} día(s)` : ""}. Ponerse al día evita intereses y reportes. ¿Puedes hacer un abono hoy, aunque sea parcial?`;
  }
  if (status === "por_vencer") {
    return `${cab}${det}\n\n⏰ *Está por vencer*${dias != null ? ` en ${dias} día(s)` : ""}. Programa tu abono hoy para no pagar recargos. ¡Vamos que se puede! 💪`;
  }
  if (status === "pagada") {
    return `${cab}\n\n🎉 ¡La deuda *${deuda}* quedó saldada! Gracias por tu compromiso con las finanzas del hogar.`;
  }
  return `${cab}${det}\n\n✅ Recordatorio amable de tu parte pendiente. Un abono constante hace la diferencia.`;
}

export function mensajeResumenPersona(opts: {
  nombre: string;
  pendienteTotal: number;
  deudas: { name: string; pending: number; due_date?: string | null }[];
  familia?: string | null;
}) {
  const { nombre, pendienteTotal, deudas, familia } = opts;
  const lista = deudas
    .map((d) => `• ${d.name}: ${formatCOP(d.pending)}${d.due_date ? ` (vence ${formatDate(d.due_date)})` : ""}`)
    .join("\n");
  return `Hola ${nombre} 👋 (HogarFin${familia ? ` · ${familia}` : ""})\n\nEste es tu resumen de deudas:\n${lista}\n\n💰 Total pendiente: *${formatCOP(pendienteTotal)}*\n\nOrganicemos los abonos de este mes. ¡Gracias por tu compromiso! 🙌`;
}

export function mensajeAhorro(opts: {
  nombre: string;
  meta: string;
  aportado: number;
  cuota: number;
  restante: number;
  porDia?: number | null;
  dias?: number | null;
  completada?: boolean;
  familia?: string | null;
  seed?: number;
}) {
  const { nombre, meta, aportado, cuota, restante, porDia, dias, completada, familia, seed } = opts;
  const cab = `Hola ${nombre} 👋 (HogarFin${familia ? ` · ${familia}` : ""})`;
  if (completada) {
    return `${cab}\n\n🏆 ¡Lo logramos! La meta *${meta}* está completa. Gracias por tu constancia, así se construye el futuro del hogar. 🎉`;
  }
  const pct = cuota > 0 ? Math.min(100, (aportado / cuota) * 100) : 0;
  return (
    `${cab}\n\n🐷 Meta de ahorro: *${meta}*\n` +
    `Tu avance: *${formatCOP(aportado)}* de ${formatCOP(cuota)} (${pct.toFixed(0)}%)\n` +
    `Falta para la meta: ${formatCOP(restante)}` +
    (porDia ? `\n📅 Con *${formatCOP(porDia)}* al día${dias ? ` durante ${dias} días` : ""} la alcanzamos.` : "") +
    `\n\n💡 Consejo: ${tipAhorro(seed ?? 0)}\n\n¡Vamos con toda, cada aporte cuenta! 💪`
  );
}

export function mensajeResumenSemanal(opts: {
  familia?: string | null;
  desde: string | Date;
  hasta: string | Date;
  deudaPendiente: number;
  abonosSemana: number;
  ahorroTotal: number;
  aportesSemana: number;
  gastosSemana: number;
  proximos: { name: string; monto: number; due_date?: string | null }[];
}) {
  const { familia, desde, hasta, deudaPendiente, abonosSemana, ahorroTotal, aportesSemana, gastosSemana, proximos } = opts;
  const lista = proximos.length
    ? proximos.map((p) => `• ${p.name}: ${formatCOP(p.monto)}${p.due_date ? ` (${formatDate(p.due_date)})` : ""}`).join("\n")
    : "• Sin pagos programados esta semana 🎉";
  return (
    `📊 *Balance semanal HogarFin*${familia ? ` · ${familia}` : ""}\n` +
    `🗓️ ${formatDate(desde)} — ${formatDate(hasta)}\n\n` +
    `💳 Deuda pendiente: *${formatCOP(deudaPendiente)}*\n` +
    `✅ Abonos de la semana: ${formatCOP(abonosSemana)}\n` +
    `🐷 Ahorro acumulado: ${formatCOP(ahorroTotal)} (aportes: ${formatCOP(aportesSemana)})\n` +
    `🧾 Caja menor de la semana: ${formatCOP(gastosSemana)}\n\n` +
    `⏳ *Próximos pagos:*\n${lista}\n\n` +
    `¡Sigamos así, cada peso cuenta! 💪`
  );
}

export function mensajeReto(opts: {
  familia?: string | null;
  reto: string;
  meta: number;
  logrado: number;
  diasRestantes: number | null;
}) {
  const { familia, reto, meta, logrado, diasRestantes } = opts;
  const pct = meta > 0 ? Math.min(100, (logrado / meta) * 100) : 0;
  if (pct >= 100) {
    return `🏆 ¡Reto cumplido!${familia ? ` (${familia})` : ""}\n\n*${reto}*\nMeta ${formatCOP(meta)} — ¡lo logramos entre todos! 🎉`;
  }
  return (
    `🔥 *Reto de la semana*${familia ? ` · ${familia}` : ""}\n\n` +
    `*${reto}*\nAvance: ${formatCOP(logrado)} de ${formatCOP(meta)} (${pct.toFixed(0)}%)\n` +
    `Faltan ${formatCOP(Math.max(0, meta - logrado))}` +
    (diasRestantes !== null ? ` y quedan ${Math.max(0, diasRestantes)} día(s).` : ".") +
    `\n\n¡Vamos con todo, cada aporte suma! 💪`
  );
}

export function mensajeRiesgoMora(opts: {
  nombre?: string | null;
  deuda: string;
  pendiente: number;
  dias: number | null;
  familia?: string | null;
}) {
  const { nombre, deuda, pendiente, dias, familia } = opts;
  return (
    `⚠️ *Alerta de riesgo de mora*${familia ? ` · ${familia}` : ""}\n\n` +
    (nombre ? `Hola ${nombre} 👋\n\n` : "") +
    `La deuda *${deuda}* tiene ${formatCOP(pendiente)} pendiente y ` +
    (dias === null ? "no tiene fecha registrada." : dias < 0 ? `ya está en mora hace ${Math.abs(dias)} día(s).` : dias === 0 ? "vence *hoy*." : `vence en *${dias} día(s)*.`) +
    `\n\nAdelántate: registra hoy tu abono y evita intereses. 🙌`
  );
}

/** Abre WhatsApp para escoger el destinatario y compartir un texto (sin número fijo). */
export function compartirWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}
