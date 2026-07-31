import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";

export async function openProof(path: string) {
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 600);
  if (error || !data) return toast.error("No se pudo abrir el comprobante");
  window.open(data.signedUrl, "_blank", "noopener");
}

export function ProofLink({ path, label = "Comprobante" }: { path?: string | null; label?: string }) {
  if (!path) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1 px-2 text-xs"
      onClick={(e) => { e.stopPropagation(); openProof(path); }}
    >
      <Paperclip className="h-3 w-3" /> {label}
    </Button>
  );
}
