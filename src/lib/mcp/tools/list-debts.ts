import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveFamily, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_debts",
  title: "Listar deudas",
  description: "Lista las deudas de la familia con su saldo pendiente (total menos abonos). Por defecto omite las pagadas.",
  inputSchema: {
    family_id: z.string().uuid().optional().describe("Familia a consultar; si se omite se usa la primera del usuario."),
    include_paid: z.boolean().optional().describe("Incluir deudas ya pagadas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ family_id, include_paid }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado.");
    const db = supabaseForUser(ctx);
    let fam;
    try { fam = await resolveFamily(db, userId, family_id); } catch (e) { throw new ToolError((e as Error).message); }
    let q = db
      .from("debts")
      .select("id, name, entity, total_amount, status, due_date, debt_type, cuota_amount")
      .eq("family_id", fam.familyId)
      .order("due_date", { ascending: true })
      .limit(200);
    if (!include_paid) q = q.neq("status", "pagada");
    const { data: debts, error } = await q;
    if (error) throw new ToolError(error.message);
    const ids = (debts ?? []).map((d) => d.id);
    const { data: pays } = ids.length
      ? await db.from("payments").select("debt_id, amount").in("debt_id", ids)
      : { data: [] as { debt_id: string; amount: number }[] };
    const paid = new Map<string, number>();
    (pays ?? []).forEach((p) => paid.set(p.debt_id, (paid.get(p.debt_id) ?? 0) + Number(p.amount)));
    const rows = (debts ?? []).map((d) => {
      const abonado = paid.get(d.id) ?? 0;
      return {
        id: d.id,
        name: d.name,
        entity: d.entity,
        status: d.status,
        due_date: d.due_date,
        total_amount: Number(d.total_amount),
        paid_amount: abonado,
        pending_amount: Math.max(0, Number(d.total_amount) - abonado),
      };
    });
    const text = rows.length
      ? rows.map((r) => `${r.name} (${r.entity}) · ${r.status} · vence ${r.due_date ?? "—"} · pendiente $${r.pending_amount.toLocaleString("es-CO")}`).join("\n")
      : "No hay deudas.";
    return { content: [{ type: "text", text: `Familia ${fam.name}:\n${text}` }], structuredContent: { family: fam.name, debts: rows } };
  },
});
