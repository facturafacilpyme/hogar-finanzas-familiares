import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveFamily, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_savings_goals",
  title: "Listar metas de ahorro",
  description: "Lista las metas de ahorro y retos de la familia con su progreso.",
  inputSchema: {
    family_id: z.string().uuid().optional().describe("Familia a consultar; si se omite se usa la primera del usuario."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ family_id }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado.");
    const db = supabaseForUser(ctx);
    let fam;
    try { fam = await resolveFamily(db, userId, family_id); } catch (e) { throw new ToolError((e as Error).message); }
    const { data, error } = await db
      .from("savings_goals")
      .select("id, name, target_amount, current_amount, due_date, is_challenge, goal_kind, broken_at, closed_at")
      .eq("family_id", fam.familyId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ToolError(error.message);
    const goals = (data ?? []).map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount);
      return {
        id: g.id,
        name: g.name,
        kind: g.goal_kind,
        is_challenge: g.is_challenge,
        target_amount: target,
        current_amount: current,
        progress_pct: target > 0 ? Math.round((current / target) * 100) : 0,
        due_date: g.due_date,
        closed: Boolean(g.closed_at || g.broken_at),
      };
    });
    const text = goals.length
      ? goals.map((g) => `${g.name}${g.is_challenge ? " (reto)" : ""} · ${g.progress_pct}% · $${g.current_amount.toLocaleString("es-CO")} de $${g.target_amount.toLocaleString("es-CO")}`).join("\n")
      : "No hay metas de ahorro.";
    return { content: [{ type: "text", text }], structuredContent: { goals } };
  },
});
