import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_families",
  title: "Listar mis familias",
  description: "Lista las familias de HogarFin a las que pertenece el usuario y su rol en cada una.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado.");
    const db = supabaseForUser(ctx);
    const { data, error } = await db
      .from("family_members")
      .select("family_id, role, families(name)")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw new ToolError(error.message);
    const families = (data ?? []).map((m: any) => ({
      family_id: String(m.family_id),
      name: String(m.families?.name ?? "Mi familia"),
      role: String(m.role),
    }));
    const text = families.length
      ? families.map((f) => `${f.name} (${f.role}) — ${f.family_id}`).join("\n")
      : "No perteneces a ninguna familia.";
    return { content: [{ type: "text", text }], structuredContent: { families } };
  },
});
