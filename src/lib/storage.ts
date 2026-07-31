import { supabase } from "@/integrations/supabase/client";

export async function uploadProof(userId: string, file: File | null | undefined): Promise<string | null> {
  if (!file) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file);
  if (error) throw error;
  return path;
}
