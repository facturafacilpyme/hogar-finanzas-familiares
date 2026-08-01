import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const purgeFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ familyId: z.string().uuid(), userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("No puedes eliminarte a ti mismo.");

    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("is_family_admin", {
      _family_id: data.familyId,
      _user_id: context.userId,
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Solo un administrador de la familia puede hacer esto.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("family_id", data.familyId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target) throw new Error("Esa persona no pertenece a tu familia.");

    await supabaseAdmin
      .from("family_members")
      .delete()
      .eq("family_id", data.familyId)
      .eq("user_id", data.userId);

    const { data: others } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("user_id", data.userId);

    if (!others || others.length === 0) {
      await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
      await supabaseAdmin.auth.admin.deleteUser(data.userId);
      return { removed: true, purged: true };
    }
    return { removed: true, purged: false };
  });