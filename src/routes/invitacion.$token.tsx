import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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

type Info = {
  valid: boolean;
  family_name: string | null;
  role: "admin" | "miembro" | "invitado";
  email: string | null;
  name: string | null;
};

function Invitacion() {
  const { token } = Route.useParams();
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("invitation_info", { _token: token });
      const row = (Array.isArray(data) ? data[0] : null) as Info | null;
      setInfo(row ?? null);
      setName(row?.name ?? "");
      setChecking(false);
    })();
  }, [token]);

  async function redeemAndGo() {
    const { error: rpcErr } = await supabase.rpc("redeem_invitation", { _token: token });
    if (rpcErr && !/ya (eres|pertenece)/i.test(rpcErr.message)) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    await refresh();
    toast.success("¡Bienvenido a la familia!");
    nav({ to: "/panel" });
  }

  // Sesión activa: canjea directo.
  useEffect(() => {
    if (loading || checking || !user || !info?.valid || busy) return;
    setBusy(true);
    redeemAndGo();
  }, [loading, checking, user, info]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.email) return;
    setBusy(true);
    setError("");
    const email = info.email;

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || info.name || email.split("@")[0] } },
    });

    if (signUpErr) {
      // La cuenta ya existe: intenta iniciar sesión con la contraseña dada.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setBusy(false);
        setError(
          "Esta cuenta ya existe. Escribe tu contraseña actual para entrar, o recupérala desde “Entrar”.",
        );
        return;
      }
    }
    await redeemAndGo();
  }

  const Logo = (
    <Link to="/" className="mb-6 flex items-center justify-center gap-2">
      <img src="/favicon.ico" alt="Logo de HogarFin" className="h-9 w-9 rounded-xl object-cover" />
      <span className="font-display text-xl font-bold">HogarFin</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {Logo}
        <Card>
          <CardHeader>
            <CardTitle>Invitación a {info?.family_name ?? "un hogar"}</CardTitle>
            <CardDescription>
              {checking
                ? "Verificando invitación…"
                : info?.valid
                  ? <>Te invitaron como <b className="capitalize">{info.role}</b>.</>
                  : "Esta invitación no existe, ya fue usada o expiró."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(checking || loading) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            )}

            {!checking && !info?.valid && (
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Ir a iniciar sesión</Link>
              </Button>
            )}

            {!checking && info?.valid && user && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Uniéndote al hogar…
              </div>
            )}

            {!checking && !loading && info?.valid && !user && info.email && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Correo</Label>
                  <Input value={info.email} readOnly disabled />
                </div>
                <div>
                  <Label htmlFor="inv-name">Nombre</Label>
                  <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="inv-pass">Crea tu contraseña</Label>
                  <Input
                    id="inv-pass"
                    type="password"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Entrando…" : "Unirme a la familia"}
                </Button>
              </form>
            )}

            {!checking && !loading && info?.valid && !user && !info.email && (
              <>
                <p className="text-sm text-muted-foreground">
                  Este es un link abierto. Crea tu cuenta o inicia sesión y se aplicará automáticamente.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    try { sessionStorage.setItem("pending_invite_token", token); } catch {}
                    nav({ to: "/auth" });
                  }}
                >
                  Entrar o crear cuenta
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}