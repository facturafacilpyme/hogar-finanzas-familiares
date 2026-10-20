import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveFamily, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_payments",
  title: "Listar abonos",
  description: "Lista los abonos más recientes a deudas de la familia, opcionalmente de una deuda concreta.",
  inputSchema: {
    family_id: z.string().uuid().optional().describe("Familia a consultar; si se omite se usa la primera del usuario."),
    debt_id: z.string().uuid().optional().describe("Filtrar por una deuda (id de list_debts)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de abonos (1-100, por defecto 30)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ family_id, debt_id, limit }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado.");
    const db = supabaseForUser(ctx);
    let fam;
    try { fam = await resolveFamily(db, userId, family_id); } catch (e) { throw new ToolError((e as Error).message); }
    let q = db
      .from("payments")
      .select("id, debt_id, amount, payment_date, notes, debts(name)")
      .eq("family_id", fam.familyId)
      .order("payment_date", { ascending: false })
      .limit(limit ?? 30);
    if (debt_id) q = q.eq("debt_id", debt_id);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((p: any) => ({
      id: String(p.id),
      debt_id: String(p.debt_id),
      debt_name: String(p.debts?.name ?? "—"),
      amount: Number(p.amount),
      payment_date: String(p.payment_date),
      notes: p.notes ? String(p.notes) : null,
    }));
    const text = rows.length
      ? rows.map((r) => `${r.payment_date} · ${r.debt_name} · $${r.amount.toLocaleString("es-CO")}`).join("\n")
      : "No hay abonos.";
    return { content: [{ type: "text", text }], structuredContent: { payments: rows } };
  },
});
