import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, MessageSquareHeart, ShieldCheck, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { enviarOpinion, CATEGORIES } from "@/lib/community.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CAT_LABEL: Record<string, string> = {
  sugerencia: "Sugerencia",
  experiencia: "Experiencia",
  error: "Reporte de error",
  idea: "Idea nueva",
};
const STATUS_LABEL: Record<string, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  planificado: "Planificado",
  implementado: "Implementado",
};

export const Route = createFileRoute("/comunidad")({
  head: () => ({
    meta: [
      { title: "Comunidad HogarFin — Opiniones e ideas de las familias" },
      { name: "description", content: "Espacio público y gratuito donde las familias que usan HogarFin comparten sugerencias, experiencias e ideas, y votan las mejoras más importantes." },
      { property: "og:title", content: "Comunidad HogarFin — Opiniones e ideas de las familias" },
      { property: "og:description", content: "Comparte tu opinión sobre HogarFin y vota las mejoras que más te interesan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Comunidad,
});

type Item = {
  id: string; alias: string; category: string; title: string; body: string;
  status: string; votes_count: number; created_at: string; user_id: string;
  published: boolean; moderation_reason: string | null;
};

function Comunidad() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [orden, setOrden] = useState<"votos" | "recientes">("votos");
  const [filtro, setFiltro] = useState<string>("todas");

  const lista = useQuery({
    queryKey: ["comunidad", orden, filtro],
    queryFn: async () => {
      let q = supabase.from("community_feedback").select("id,alias,category,title,body,status,votes_count,created_at,user_id,published,moderation_reason").eq("published", true);
      if (filtro !== "todas") q = q.eq("category", filtro);
      q = orden === "votos" ? q.order("votes_count", { ascending: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as Item[];
    },
  });

  const misVotos = useQuery({
    queryKey: ["comunidad-votos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("community_votes").select("feedback_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((v) => v.feedback_id));
    },
  });

  const rechazadas = useQuery({
    queryKey: ["comunidad-mias", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("community_feedback").select("id,title,moderation_reason,created_at").eq("user_id", user!.id).eq("published", false).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["comunidad"] }).then(() => {
    qc.invalidateQueries({ queryKey: ["comunidad-votos"] });
    qc.invalidateQueries({ queryKey: ["comunidad-mias"] });
  });

  async function votar(id: string) {
    if (!user) return toast.info("Inicia sesión para votar.");
    const ya = misVotos.data?.has(id);
    const { error } = ya
      ? await supabase.from("community_votes").delete().eq("feedback_id", id).eq("user_id", user.id)
      : await supabase.from("community_votes").insert({ feedback_id: id, user_id: user.id });
    if (error) return toast.error("No se pudo registrar tu voto.");
    refrescar();
  }

  async function borrar(id: string) {
    const { error } = await supabase.from("community_feedback").delete().eq("id", id);
    if (error) return toast.error("No se pudo eliminar.");
    toast.success("Opinión eliminada.");
    refrescar();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a HogarFin
        </Link>
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <MessageSquareHeart className="h-7 w-7 text-primary" /> Comunidad HogarFin
          </h1>
          <p className="text-muted-foreground">
            Un espacio público y gratuito para compartir sugerencias, experiencias e ideas. Vota las que más te interesan para priorizar mejoras.
          </p>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Cada opinión se revisa automáticamente con inteligencia artificial: solo se publica si es respetuosa y no incluye montos, cuentas, correos ni datos de tu familia.
          </p>
        </header>

        {user ? <Formulario onDone={refrescar} /> : (
          <Card><CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Inicia sesión para publicar tu opinión y votar.</p>
            <Link to="/auth"><Button>Iniciar sesión</Button></Link>
          </CardContent></Card>
        )}

        {!!rechazadas.data?.length && (
          <Card className="border-destructive/40">
            <CardHeader className="pb-2"><CardTitle className="text-base">Tus opiniones no publicadas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rechazadas.data.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0"><p className="font-medium break-words">{r.title}</p><p className="text-muted-foreground break-words">{r.moderation_reason}</p></div>
                  <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => borrar(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={orden} onValueChange={(v) => setOrden(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="votos">Más votadas</SelectItem>
              <SelectItem value="recientes">Más recientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {lista.isLoading && <p className="text-sm text-muted-foreground">Cargando opiniones…</p>}
          {lista.data?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay opiniones aquí. ¡Sé la primera persona en compartir!</p>}
          {lista.data?.map((it) => {
            const votado = misVotos.data?.has(it.id);
            return (
              <Card key={it.id}>
                <CardContent className="flex gap-3 py-4">
                  <button
                    onClick={() => votar(it.id)}
                    aria-label={votado ? "Quitar voto" : "Me interesa"}
                    className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${votado ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <ThumbsUp className="h-4 w-4" />{it.votes_count}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{CAT_LABEL[it.category] ?? it.category}</Badge>
                      <Badge variant="outline">{STATUS_LABEL[it.status] ?? it.status}</Badge>
                    </div>
                    <h2 className="font-semibold break-words">{it.title}</h2>
                    <p className="whitespace-pre-line text-sm text-muted-foreground break-words">{it.body}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{it.alias} · {new Date(it.created_at).toLocaleDateString("es-CO")}</span>
                      {user?.id === it.user_id && (
                        <button onClick={() => borrar(it.id)} className="hover:text-destructive">Eliminar</button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Formulario({ onDone }: { onDone: () => void }) {
  const enviar = useServerFn(enviarOpinion);
  const [alias, setAlias] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("sugerencia");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (alias.trim().length < 2) return toast.error("Escribe un alias de al menos 2 caracteres.");
    if (title.trim().length < 5) return toast.error("El título debe tener al menos 5 caracteres.");
    if (body.trim().length < 10) return toast.error("Cuéntanos un poco más (mínimo 10 caracteres).");
    setBusy(true);
    try {
      const r = await enviar({ data: { alias, category, title, body } });
      if (r.approved) {
        toast.success("¡Gracias! Tu opinión ya está publicada.");
        setTitle(""); setBody("");
      } else {
        toast.error(r.reason || "Tu opinión no cumple las normas de la comunidad.");
      }
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar tu opinión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Comparte tu opinión</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Tu alias público" maxLength={40} value={alias} onChange={(e) => setAlias(e.target.value)} />
            <Select value={category} onValueChange={(v) => setCategory(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Título breve" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Cuéntanos tu idea o experiencia (sin montos ni datos personales)" maxLength={1200} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{body.length}/1200</span>
            <Button type="submit" disabled={busy}>{busy ? "Revisando…" : "Publicar"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
