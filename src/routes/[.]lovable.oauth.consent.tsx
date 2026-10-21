import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: any; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const SCOPES: Record<string, string> = {
  openid: "Confirmar tu identidad",
  email: "Compartir tu correo electrónico",
  profile: "Compartir tu perfil básico",
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Autorizar conexión — HogarFin" },
      { name: "description", content: "Autoriza a un asistente a consultar tus finanzas en HogarFin." },
      { property: "og:title", content: "Autorizar conexión — HogarFin" },
      { property: "og:description", content: "Autoriza a un asistente a consultar tus finanzas en HogarFin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta el identificador de autorización.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps }) => {
    const { data, error } = await oauth().getAuthorizationDetails(deps.id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="max-w-md">
        <CardHeader><CardTitle>No se pudo cargar la solicitud</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}. La solicitud puede haber vencido; vuelve a conectar desde el asistente.
        </CardContent>
      </Card>
    </div>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "Un asistente";
  const scopes = String(details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("El servidor de autorización no devolvió a dónde regresar."); return; }
    window.location.href = target;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar {client} con HogarFin</CardTitle>
          <CardDescription>
            {client} podrá consultar tus deudas, abonos, metas de ahorro y gastos mientras tengas la sesión activa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {email && <p>Cuenta: <b>{email}</b></p>}
          {details?.redirect_uri && (
            <p className="break-all text-xs text-muted-foreground">Regresará a: {details.redirect_uri}</p>
          )}
          {scopes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {scopes.map((s) => <li key={s}>{SCOPES[s] ?? `Permiso adicional solicitado: ${s}`}</li>)}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Esto no salta los permisos de tu rol en la familia: solo verá lo que tú ya puedes ver.
          </p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Autorizar</Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
