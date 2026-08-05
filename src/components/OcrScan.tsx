import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { leerComprobante, type ComprobanteLeido } from "@/lib/ocr.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatCOP, formatDate } from "@/lib/currency";

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

interface Props {
  /** Se llama con el archivo elegido para que el formulario lo adjunte como comprobante. */
  onFile?: (file: File) => void;
  /** Datos extraídos del comprobante. */
  onResult: (data: ComprobanteLeido) => void;
  title?: string;
  hint?: string;
}

export function OcrScan({ onFile, onResult, title = "Leer comprobante automáticamente", hint }: Props) {
  const scan = useServerFn(leerComprobante);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<ComprobanteLeido | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen es muy pesada (máx. 8 MB).");
    onFile?.(file);
    setLoading(true);
    setLast(null);
    try {
      const dataUrl = await toDataUrl(file);
      const data = await scan({ data: { dataUrl, mimeType: file.type || "image/jpeg", filename: file.name } });
      setLast(data);
      onResult(data);
      if (data.amount || data.date || data.entity) toast.success("Comprobante leído: revisa y confirma los datos.");
      else toast.warning("No se reconocieron datos. Escríbelos a mano.");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo leer el comprobante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed bg-accent/30 p-3">
      <Label className="flex items-center gap-2 text-sm">
        <ScanLine className="h-4 w-4 shrink-0 text-primary" /> {title}
      </Label>
      <p className="mt-1 text-xs text-muted-foreground">
        {hint ?? "Toma o sube la foto de la transferencia o el recibo y los campos se llenan solos."}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2 w-full"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo comprobante…</> : <><ScanLine className="mr-2 h-4 w-4" /> Escanear comprobante</>}
      </Button>
      {last && (last.amount || last.date || last.entity) && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-success/10 p-2 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">
            {last.amount ? `Monto ${formatCOP(last.amount)}` : "Sin monto"}
            {last.date ? ` · ${formatDate(last.date)}` : ""}
            {last.entity ? ` · ${last.entity}` : ""}
            {` · confianza ${(last.confidence * 100).toFixed(0)}%`}
          </span>
        </div>
      )}
    </div>
  );
}
