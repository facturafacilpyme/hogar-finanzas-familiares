import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openWhatsApp } from "@/lib/whatsapp";

interface Props {
  phone?: string | null;
  message: string;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}

export function WhatsAppButton({ phone, message, label = "WhatsApp", size = "sm", variant = "outline", className }: Props) {
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        if (!openWhatsApp(phone, message)) {
          toast.error("Esta persona no tiene un número de WhatsApp guardado. Agrégalo en Mi familia.");
        }
      }}
    >
      <MessageCircle className="mr-1 h-3.5 w-3.5 text-success" />
      {size !== "icon" && label}
    </Button>
  );
}
