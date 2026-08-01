import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta — HogarFin" },
      { name: "description", content: "Actualiza tu nombre y tu contraseña en HogarFin." },
      { property: "og:title", content: "Mi cuenta — HogarFin" },
      { property: "og:description", content: "Actualiza tu nombre y tu contraseña en HogarFin." },
    ],
  }),
  component: Cuenta,
});

function Cuenta() {
  const { user, profile, refresh } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => setName(profile?.name ?? ""), [profile?.name]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Nombre actualizado");
    refresh();
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const pass = String(fd.get("password"));
    if (pass !== String(fd.get("confirm"))) return toast.error("Las contraseñas no coinciden");
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setChanging(false);
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Contraseña actualizada");
  }

  async function sendReset() {
    if (!profile?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Te enviamos un correo para restablecer tu contraseña.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="ac-name">Nombre</Label>
              <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" variant="outline" disabled={saving}>Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Cambiar contraseña</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <Label htmlFor="ac-p1">Nueva contraseña</Label>
              <Input id="ac-p1" name="password" type="password" minLength={6} required autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="ac-p2">Confirmar contraseña</Label>
              <Input id="ac-p2" name="confirm" type="password" minLength={6} required autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={changing}>{changing ? "Guardando…" : "Actualizar contraseña"}</Button>
          </form>
          <Button variant="link" className="px-0" onClick={sendReset}>
            Prefiero recibir un correo de recuperación
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}