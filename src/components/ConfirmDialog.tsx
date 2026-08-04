import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Confirm | null>(null);

/** Reemplaza a window.confirm con un diálogo con el estilo de la app. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(value: boolean) {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title ?? "¿Confirmas esta acción?"}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription className="whitespace-pre-line break-words">
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{opts.cancelText ?? "Cancelar"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {opts.confirmText ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}
