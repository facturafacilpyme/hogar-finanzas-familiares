import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nueva contraseña — HogarFin" },
      { name: "description", content: "Crea una nueva contraseña para tu cuenta de HogarFin." },
      { property: "og:title", content: "Nueva contraseña — HogarFin" },
      { property: "og:description", content: "Crea una nueva contraseña para tu cuenta de HogarFin." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pass = String(fd.get("password"));
    if (pass !== String(fd.get("confirm"))) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    nav({ to: "/panel" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/favicon.ico" alt="Logo de HogarFin" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-display text-xl font-bold">HogarFin</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Escribe la contraseña que usarás de ahora en adelante.</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-sm text-muted-foreground">
                Abre este enlace desde el correo de recuperación para poder cambiar tu contraseña.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="np">Nueva contraseña</Label>
                  <Input id="np" name="password" type="password" minLength={6} required autoComplete="new-password" />
                </div>
                <div>
                  <Label htmlFor="np2">Confirmar contraseña</Label>
                  <Input id="np2" name="confirm" type="password" minLength={6} required autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Guardando…" : "Guardar contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}