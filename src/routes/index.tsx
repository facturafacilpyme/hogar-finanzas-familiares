import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  PiggyBank,
  Calendar,
  BellRing,
  Users,
  ShieldCheck,
  Receipt,
  BarChart3,
  HandCoins,
  History,
  ScanLine,
  WifiOff,
  Smartphone,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HogarFin — Deudas, ahorros y gastos de tu familia" },
      { name: "description", content: "PWA gratuita para varias familias: deudas a cuotas, abonos con comprobante, caja menor con presupuestos y OCR, metas de ahorro, reportes en Excel/PDF y avisos por WhatsApp." },
      { property: "og:title", content: "HogarFin — Deudas, ahorros y gastos de tu familia" },
      { property: "og:description", content: "PWA gratuita para varias familias: deudas a cuotas, abonos con comprobante, caja menor con presupuestos y OCR, metas de ahorro, reportes en Excel/PDF y avisos por WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://hogar-fin.lovable.app/" }],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/panel" });
  }, [loading, user, nav]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src="/favicon.ico" alt="Logo de HogarFin" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-display text-xl font-bold">HogarFin</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost">Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6 md:pt-16">
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Gratis · Cada familia con su espacio privado
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              Las <span className="text-primary">deudas, gastos y ahorros</span> de tu hogar, organizados de verdad.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Reparte cada deuda por porcentaje o valor fijo, registra abonos con comprobante,
              controla la caja menor con presupuestos y recibe alertas antes de caer en mora.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg">Crear mi hogar</Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Ya tengo cuenta</Button>
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Se instala como app en tu celular (PWA) y funciona aunque se te vaya la señal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { i: Wallet, t: "Deudas y cuotas", d: "Únicas o a cuotas mes a mes" },
              { i: HandCoins, t: "Abonos", d: "Con comprobante y totales por persona" },
              { i: Calendar, t: "Calendario", d: "Semáforo y riesgo de mora" },
              { i: PiggyBank, t: "Metas de ahorro", d: "Aportes, retiros y miembros por meta" },
              { i: Receipt, t: "Caja menor", d: "Presupuestos por categoría" },
              { i: BarChart3, t: "Reportes", d: "Excel, PDF y CSV" },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 font-semibold">{t}</div>
                <div className="text-xs text-muted-foreground">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold md:text-3xl">Lo que ya puedes hacer hoy</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                i: Wallet,
                t: "Deudas con reglas claras",
                d: "Reparto por porcentaje o valor fijo, filtros y orden por fecha, nombre o valor, estado automático (activa, por vencer, mora, pagada) y comprobante de pago total obligatorio al cerrarla.",
              },
              {
                i: Receipt,
                t: "Caja menor con presupuestos",
                d: "Gastos por categoría con límite mensual, semáforo verde/amarillo/rojo y aviso al pasar el 90 %. El interés por mora que pagues se registra solo como gasto.",
              },
              {
                i: ScanLine,
                t: "Lectura de recibos (OCR)",
                d: "Toma la foto del recibo y la app propone monto, fecha y entidad para no digitar a mano.",
              },
              {
                i: PiggyBank,
                t: "Ahorro en familia",
                d: "Metas con progreso, aportes y retiros con comprobante, miembros asignados a cada meta y la opción de romper o restaurar una meta.",
              },
              {
                i: BellRing,
                t: "Avisos que llegan a tiempo",
                d: "Campana en tiempo real, pop-up de recordatorios según tu rol y alertas predictivas de riesgo de mora hasta 5 días antes.",
              },
              {
                i: MessageCircle,
                t: "Recordatorios por WhatsApp",
                d: "Comparte la deuda pendiente o el balance semanal por WhatsApp con un toque, sin costos ni integraciones pagas.",
              },
              {
                i: BarChart3,
                t: "Reportes exportables",
                d: "Gráficas del hogar y descarga de balances en Excel, PDF o CSV.",
              },
              {
                i: History,
                t: "Historial completo",
                d: "Cada deuda, abono, gasto, meta y cambio de miembro queda registrado en el log de actividad.",
              },
              {
                i: WifiOff,
                t: "Funciona con mala señal",
                d: "Los registros se guardan en una cola local y se sincronizan solos cuando vuelve la conexión.",
              },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold md:text-3xl">Un rol para cada integrante</h2>
          <p className="mt-2 text-muted-foreground">
            Invita por enlace (válido 7 días) y decide qué puede hacer cada persona.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Administrador", d: "Control total: deudas, presupuestos, metas, miembros, roles e invitaciones." },
              { t: "Miembro", d: "Registra abonos, gastos y aportes; ve toda la información del hogar." },
              { t: "Educativo (hijos)", d: "Aprende ahorrando: aporta a metas, sin tocar deudas ni caja menor." },
              { t: "Invitado", d: "Solo lectura de la información de la familia." },
            ].map(({ t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{t}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border bg-card p-6 shadow-sm md:p-10">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Smartphone className="h-5 w-5" />
                <span className="text-sm font-semibold">Varias familias, datos separados</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">
                Cada hogar ve solo lo suyo
              </h2>
              <p className="mt-3 text-muted-foreground">
                Puedes pertenecer a más de una familia y cambiar entre ellas desde el encabezado.
                La información de cada hogar está aislada y protegida en el servidor.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/auth">
                <Button size="lg">Empezar gratis</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} HogarFin. Finanzas familiares sanas.
        </div>
      </footer>
    </div>
  );
}
