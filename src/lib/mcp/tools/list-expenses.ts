import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveFamily, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_expenses",
  title: "Listar gastos de Caja Menor",
  description: "Lista los gastos de Caja Menor de un mes con totales por categoría.",
  inputSchema: {
    family_id: z.string().uuid().optional().describe("Familia a consultar; si se omite se usa la primera del usuario."),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().describe("Mes en formato AAAA-MM; por defecto el mes actual."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ family_id, month }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado.");
    const db = supabaseForUser(ctx);
    let fam;
    try { fam = await resolveFamily(db, userId, family_id); } catch (e) { throw new ToolError((e as Error).message); }
    const m = month ?? new Date().toISOString().slice(0, 7);
    const [y, mm] = m.split("-").map(Number);
    const start = `${m}-01`;
    const end = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 10);
    const [{ data, error }, { data: cats }] = await Promise.all([
      db.from("expenses").select("id, category, amount, expense_date, description")
        .eq("family_id", fam.familyId).gte("expense_date", start).lt("expense_date", end)
        .order("expense_date", { ascending: false }).limit(500),
      db.from("expense_categories").select("slug, name").eq("family_id", fam.familyId),
    ]);
    if (error) throw new ToolError(error.message);
    const nameOf = (s: string) => cats?.find((c) => c.slug === s)?.name ?? s;
    const byCat = new Map<string, number>();
    const expenses = (data ?? []).map((e) => {
      const category = nameOf(e.category);
      byCat.set(category, (byCat.get(category) ?? 0) + Number(e.amount));
      return { id: e.id, category, amount: Number(e.amount), date: e.expense_date, description: e.description };
    });
    const totals = [...byCat.entries()].map(([category, total]) => ({ category, total }));
    const total = totals.reduce((s, t) => s + t.total, 0);
    const text = `Gastos ${m}: $${total.toLocaleString("es-CO")}\n` +
      (totals.map((t) => `${t.category}: $${t.total.toLocaleString("es-CO")}`).join("\n") || "Sin gastos.");
    return { content: [{ type: "text", text }], structuredContent: { month: m, total, totals, expenses } };
  },
});
