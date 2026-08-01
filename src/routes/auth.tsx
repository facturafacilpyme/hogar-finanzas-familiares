import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — HogarFin" }, { name: "description", content: "Ingresa a HogarFin." }] }),
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem("pending_invite_token"); } catch {}
    if (pending) {
      sessionStorage.removeItem("pending_invite_token");
      nav({ to: "/invitacion/$token", params: { token: pending } });
    } else {
      nav({ to: "/panel" });
    }
  }, [user, nav]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("¡Bienvenido!");
      nav({ to: "/panel" });
    }
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        data: { name: String(fd.get("name")) },
        emailRedirectTo: `${window.location.origin}/panel`,
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Cuenta creada. ¡Bienvenido!");
      nav({ to: "/panel" });
    }
  }

  async function sendReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.resetPasswordForEmail(String(fd.get("email")), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Te enviamos un correo para restablecer tu contraseña.");
      setForgot(false);
    }
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
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>Organiza las finanzas de tu familia.</CardDescription>
          </CardHeader>
          <CardContent>
            {forgot ? (
              <form onSubmit={sendReset} className="space-y-3">
                <div>
                  <Label htmlFor="fp-email">Correo de tu cuenta</Label>
                  <Input id="fp-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando…" : "Enviar link de recuperación"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setForgot(false)}>
                  Volver
                </Button>
              </form>
            ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Registrarme</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div>
                    <Label htmlFor="si-email">Correo</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div>
                    <Label htmlFor="si-pass">Contraseña</Label>
                    <Input id="si-pass" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>
                  <Button type="button" variant="link" className="w-full" onClick={() => setForgot(true)}>
                    ¿Olvidaste tu contraseña?
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-4">
                  <div><Label htmlFor="su-name">Nombre</Label><Input id="su-name" name="name" required /></div>
                  <div><Label htmlFor="su-email">Correo</Label><Input id="su-email" name="email" type="email" required autoComplete="email" /></div>
                  <div><Label htmlFor="su-pass">Contraseña</Label><Input id="su-pass" name="password" type="password" required minLength={6} autoComplete="new-password" /></div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando…" : "Crear cuenta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Al registrarte se crea tu propia familia y quedas como administrador.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}