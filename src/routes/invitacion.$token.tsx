import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/invitacion/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Invitación — HogarFin" },
      { name: "description", content: "Únete a un hogar en HogarFin." },
    ],
  }),
  component: Invitacion,
});

function Invitacion() {
  const { token } = Route.useParams();
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<"idle" | "redeeming" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function redeem() {
    setState("redeeming");
    const { data, error } = await supabase.rpc("redeem_invitation", { _token: token });
    if (error) {
      setState("error");
      setMessage(error.message);
      toast.error(error.message);
      return;
    }
    const role = Array.isArray(data) ? (data[0]?.role ?? "invitado") : "invitado";
    await refresh();
    setState("done");
    toast.success(`¡Te uniste como ${role}!`);
    setTimeout(() => nav({ to: "/panel" }), 800);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // guarda el token y manda al registro
      try {
        sessionStorage.setItem("pending_invite_token", token);
      } catch {}
      return;
    }
    if (state === "idle") redeem();
  }, [loading, user, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">HogarFin</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Invitación al hogar</CardTitle>
            <CardDescription>
              Fuiste invitado como <b>Invitado</b> (solo lectura).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            )}

            {!loading && !user && (
              <>
                <p className="text-sm text-muted-foreground">
                  Necesitas una cuenta para aceptar la invitación. Al iniciar sesión o registrarte, se aplicará automáticamente.
                </p>
                <Button asChild className="w-full">
                  <Link to="/auth">Entrar o crear cuenta</Link>
                </Button>
              </>
            )}

            {user && state === "redeeming" && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Uniéndote al hogar…
              </div>
            )}

            {user && state === "done" && (
              <p className="text-sm text-success">¡Listo! Redirigiendo al panel…</p>
            )}

            {user && state === "error" && (
              <>
                <p className="text-sm text-destructive">{message}</p>
                <Button variant="outline" className="w-full" onClick={() => nav({ to: "/panel" })}>
                  Ir al panel
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}