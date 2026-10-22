import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const CATEGORIES = ["sugerencia", "experiencia", "error", "idea"] as const;

const Input = z.object({
  alias: z.string().trim().min(2).max(40),
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(5).max(100),
  body: z.string().trim().min(10).max(1200),
});

const MODEL = "openai/gpt-6-astra";

const INSTRUCTIONS = `Eres el moderador de la comunidad pública de HogarFin, una app familiar de finanzas.
Evalúa la opinión recibida. Apruébala (approved=true) solo si:
- El lenguaje es respetuoso: sin insultos, odio, acoso, discriminación, contenido sexual, amenazas ni spam/publicidad.
- No contiene datos personales: correos, teléfonos, direcciones, documentos, nombres completos de terceros.
- No contiene información financiera sensible: montos concretos de deudas o ingresos, números de cuenta o tarjeta, nombres de entidades asociados a deudas personales.
La crítica negativa expresada con respeto SÍ se aprueba.
Si la rechazas, en "reason" explica en español, en una frase amable, qué debe corregir. Si la apruebas, reason="".`;

async function moderar(texto: string, key: string): Promise<{ approved: boolean; reason: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      input: texto,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "moderacion",
          strict: true,
          schema: {
            type: "object",
            properties: { approved: { type: "boolean" }, reason: { type: "string" } },
            required: ["approved", "reason"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (res.status === 429) throw new Error("Hay muchas opiniones en revisión. Intenta de nuevo en un minuto.");
  if (res.status === 402 || res.status === 403) throw new Error("La revisión automática no está disponible en este momento.");
  if (!res.ok || !res.body) throw new Error("No se pudo revisar tu opinión. Intenta más tarde.");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let refused = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.refusal.delta") refused = true;
      } catch {
        /* fragmento incompleto */
      }
    }
  }
  if (refused) return { approved: false, reason: "Tu opinión no cumple las normas de la comunidad." };
  try {
    const p = JSON.parse(out);
    return { approved: !!p.approved, reason: String(p.reason ?? "").slice(0, 300) };
  } catch {
    throw new Error("No se pudo revisar tu opinión. Intenta más tarde.");
  }
}

export const enviarOpinion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("La revisión automática no está disponible en este momento.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("community_feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", desde);
    if ((count ?? 0) >= 5) throw new Error("Puedes enviar hasta 5 opiniones por día. Gracias por participar.");

    const r = await moderar(
      `Alias: ${data.alias}\nCategoría: ${data.category}\nTítulo: ${data.title}\nOpinión: ${data.body}`,
      key,
    );

    const { error } = await supabaseAdmin.from("community_feedback").insert({
      user_id: context.userId,
      alias: data.alias,
      category: data.category,
      title: data.title,
      body: data.body,
      published: r.approved,
      moderation_reason: r.approved ? null : r.reason || "No cumple las normas de la comunidad.",
      moderation_model: MODEL,
    });
    if (error) throw new Error("No se pudo guardar tu opinión.");
    return r;
  });
