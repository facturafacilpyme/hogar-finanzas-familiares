import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, PiggyBank, Calendar, BellRing, Users, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HogarFin — Organiza las finanzas de tu familia" },
      { name: "description", content: "App familiar para controlar deudas, asignar pagos, ahorrar juntos y recibir alertas gratis." },
      { property: "og:title", content: "HogarFin — Organiza las finanzas de tu familia" },
      { property: "og:description", content: "App familiar para controlar deudas, asignar pagos, ahorrar juntos y recibir alertas gratis." },
    ],
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
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
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
              <ShieldCheck className="h-3.5 w-3.5" /> 100% gratis para tu familia
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              Controla las <span className="text-primary">deudas y ahorros</span> de tu familia en un solo lugar.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Asigna pagos, registra abonos con foto, ahorra juntos y recibe alertas antes de cada vencimiento.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg">Crear mi hogar</Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Ya tengo cuenta</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { i: Wallet, t: "Deudas asignadas", d: "Reparte % por miembro" },
              { i: PiggyBank, t: "Ahorro familiar", d: "Metas y retos semanales" },
              { i: Calendar, t: "Calendario", d: "Alertas 3 días antes" },
              { i: BellRing, t: "Notificaciones", d: "En tiempo real, gratis" },
              { i: Users, t: "Roles claros", d: "Admin, miembro, invitado" },
              { i: ShieldCheck, t: "Historial", d: "Nada se borra, todo queda" },
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
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} HogarFin. Finanzas familiares sanas.
        </div>
      </footer>
    </div>
  );
}
