import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  /** Imagen o PDF del comprobante como data URL (data:image/jpeg;base64,...). */
  dataUrl: z.string().min(20),
  mimeType: z.string().min(3),
  filename: z.string().optional(),
});

export interface ComprobanteLeido {
  amount: number | null;
  date: string | null;
  entity: string | null;
  reference: string | null;
  category: string | null;
  confidence: number;
  raw: string | null;
}

const PROMPT = `Eres un lector de comprobantes de pago colombianos (transferencias Nequi/Daviplata/Bancolombia, recibos, facturas de supermercado).
Extrae los datos del comprobante en la imagen y responde SOLO un objeto JSON con esta forma exacta:
{"amount": number|null, "date": "YYYY-MM-DD"|null, "entity": string|null, "reference": string|null, "category": "mercado"|"transporte"|"salud"|"servicios"|"otros"|null, "confidence": number}
Reglas:
- amount es el valor total pagado en pesos colombianos, solo el número (sin puntos ni símbolos).
- date en formato YYYY-MM-DD. Si el año no aparece, usa el año actual.
- entity es el banco, comercio o entidad que aparece en el comprobante.
- category solo si es un gasto de hogar identificable.
- confidence entre 0 y 1 según qué tan legible fue el comprobante.
No agregues explicaciones ni bloques de código.`;

export const leerComprobante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }): Promise<ComprobanteLeido> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("El lector de comprobantes no está disponible en este momento.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "user",
            content: data.mimeType === "application/pdf"
              ? [
                  { type: "text", text: PROMPT },
                  { type: "file", file: { filename: data.filename ?? "comprobante.pdf", file_data: data.dataUrl } },
                ]
              : [
                  { type: "text", text: PROMPT },
                  { type: "image_url", image_url: { url: data.dataUrl } },
                ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Demasiadas lecturas seguidas. Espera un momento e intenta de nuevo.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de lectura automática de comprobantes.");
    if (!res.ok) throw new Error("No se pudo leer el comprobante. Intenta con una foto más nítida.");

    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { amount: null, date: null, entity: null, reference: null, category: null, confidence: 0, raw: text || null };

    try {
      const parsed = JSON.parse(match[0]);
      const amount = Number(String(parsed.amount ?? "").toString().replace(/[^\d.-]/g, ""));
      return {
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
        entity: parsed.entity ? String(parsed.entity).slice(0, 120) : null,
        reference: parsed.reference ? String(parsed.reference).slice(0, 120) : null,
        category: ["mercado", "transporte", "salud", "servicios", "otros"].includes(parsed.category) ? parsed.category : null,
        confidence: Number(parsed.confidence) >= 0 && Number(parsed.confidence) <= 1 ? Number(parsed.confidence) : 0.6,
        raw: null,
      };
    } catch {
      return { amount: null, date: null, entity: null, reference: null, category: null, confidence: 0, raw: text };
    }
  });
