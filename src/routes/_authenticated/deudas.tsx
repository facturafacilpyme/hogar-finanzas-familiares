import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wallet, Upload, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/currency";
import { debtStatus, memberBreakdown, STATUS_META, sum } from "@/lib/debts";
import { uploadProof } from "@/lib/storage";
import { ProofLink } from "@/components/ProofLink";
import { OcrScan } from "@/components/OcrScan";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { mensajeDeuda } from "@/lib/whatsapp";
import { daysUntil } from "@/lib/currency";
import { useConfirm } from "@/components/ConfirmDialog";
import { queuedWrite } from "@/lib/syncQueue";

export const Route = createFileRoute("/_authenticated/deudas")({
  validateSearch: (search: Record<string, unknown>) => ({
    debtId: typeof search.debtId === "string" ? search.debtId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Deudas — HogarFin" },
      { name: "description", content: "Gestión de deudas familiares, responsables y abonos." },
      { property: "og:title", content: "Deudas — HogarFin" },
      { property: "og:description", content: "Gestión de deudas familiares, responsables y abonos." },
    ],
  }),
  component: Deudas,
});

function Deudas() {
  const { user, role, familyId, familyName } = useAuth();
  const { debtId } = Route.useSearch();
  const [debts, setDebts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [orden, setOrden] = useState<string>("fecha");
  const [openNew, setOpenNew] = useState(false);


  const load = useCallback(async () => {
    if (!familyId) return;
    const [{ data: d }, { data: m }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from("debts").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("debt_members").select("*").eq("family_id", familyId),
      supabase.from("family_members").select("user_id").eq("family_id", familyId),
      supabase.from("payments").select("*").eq("family_id", familyId),
    ]);
    setDebts(d ?? []);
    setMembers(m ?? []);
    const ids = (p ?? []).map((x: any) => x.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, name, email, phone").in("id", ids)
      : { data: [] as any[] };
    setProfiles(profs ?? []);
    setPayments(pay ?? []);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(familyId, load);

  useEffect(() => {
    if (!debtId || debts.length === 0) return;
    if (!debts.some((d) => d.id === debtId)) {
      toast.info("Esa deuda ya no existe.");
      return;
    }
    const el = document.getElementById(`debt-${debtId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [debtId, debts]);


  const isAdmin = role === "admin";

  const withStatus = useMemo(
    () => debts.map((d) => ({ debt: d, status: debtStatus(d, payments.filter((p) => p.debt_id === d.id)) })),
    [debts, payments],
  );
  const filtered = useMemo(() => {
    const base = withStatus.filter(({ status }) => {
      if (filterStatus === "todos") return true;
      if (filterStatus === "activa") return status === "activa" || status === "por_vencer";
      return status === filterStatus;
    });
    const cmp: Record<string, (a: any, b: any) => number> = {
      alfabetico: (a, b) => String(a.debt.name).localeCompare(String(b.debt.name), "es", { sensitivity: "base" }),
      alfabetico_desc: (a, b) => String(b.debt.name).localeCompare(String(a.debt.name), "es", { sensitivity: "base" }),
      fecha: (a, b) => (a.debt.due_date ?? "9999-12-31").localeCompare(b.debt.due_date ?? "9999-12-31"),
      fecha_desc: (a, b) => (b.debt.due_date ?? "0000-01-01").localeCompare(a.debt.due_date ?? "0000-01-01"),
      valor_desc: (a, b) => Number(b.debt.total_amount) - Number(a.debt.total_amount),
      valor: (a, b) => Number(a.debt.total_amount) - Number(b.debt.total_amount),
    };
    return [...base].sort(cmp[orden] ?? cmp.fecha);
  }, [withStatus, filterStatus, orden]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Deudas</h1>
          <p className="text-sm text-muted-foreground">Todas las obligaciones del hogar.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-40 sm:flex-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="activa">Activas</SelectItem>
              <SelectItem value="por_vencer">Por vencer</SelectItem>
              <SelectItem value="mora">En mora</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orden} onValueChange={setOrden}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fecha">Fecha de vencimiento (próxima)</SelectItem>
              <SelectItem value="fecha_desc">Fecha de vencimiento (lejana)</SelectItem>
              <SelectItem value="alfabetico">Nombre A → Z</SelectItem>
              <SelectItem value="alfabetico_desc">Nombre Z → A</SelectItem>
              <SelectItem value="valor_desc">Valor total (mayor)</SelectItem>
              <SelectItem value="valor">Valor total (menor)</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button className="shrink-0" onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" /> Nueva</Button>
          )}
        </div>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva deuda</DialogTitle></DialogHeader>
          <DebtForm
            profiles={profiles}
            userId={user!.id}
            familyId={familyId!}
            onDone={() => { setOpenNew(false); load(); }}
          />
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin deudas con este filtro.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(({ debt, status }) => (
            <div
              key={debt.id}
              id={`debt-${debt.id}`}
              className={debtId === debt.id ? "rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background" : undefined}
            >
              <DebtCard
                debt={debt}
                status={status}
                members={members.filter((m) => m.debt_id === debt.id)}
                profiles={profiles}
                payments={payments.filter((p) => p.debt_id === debt.id)}
                onChange={load}
                canPay={role !== "invitado"}
                isAdmin={isAdmin}
                userId={user!.id}
                familyId={familyId!}
                familyName={familyName}
              />
            </div>
          ))}
        </div>

      )}
    </div>
  );
}

function DebtCard({ debt, status, members, profiles, payments, onChange, canPay, isAdmin, userId, familyId, familyName }: any) {
  const paid = sum(payments);
  const remaining = Math.max(0, Number(debt.total_amount) - paid);
  const pct = Number(debt.total_amount) ? Math.min(100, (paid / Number(debt.total_amount)) * 100) : 0;
  const [openPay, setOpenPay] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openProof, setOpenProof] = useState(false);
  const confirmar = useConfirm();
  const meta = STATUS_META[status as keyof typeof STATUS_META];
  const breakdown = memberBreakdown(members, payments);
  const nameOf = (id: string) => profiles.find((p: any) => p.id === id)?.name ?? "?";
  const profOf = (id: string) => profiles.find((p: any) => p.id === id);
  const dias = daysUntil(debt.due_date);

  const necesitaComprobante = status === "pagada" && !debt.settlement_proof_url;
  const vence = debt.settlement_due_at ? new Date(debt.settlement_due_at) : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="min-w-0 break-words font-semibold">{debt.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {debt.entity} · {debt.debt_type === "cuotas" ? `${debt.total_cuotas} cuotas` : "Pago único"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{formatCOP(remaining)}</div>
            <div className="text-xs text-muted-foreground">de {formatCOP(debt.total_amount)}</div>
          </div>
        </div>

        <Progress value={pct} className="mt-3 h-1.5" />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Abonado {formatCOP(paid)}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>

        {breakdown.length > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border p-3">
            <div className="text-xs font-semibold text-muted-foreground">Responsables</div>
            {breakdown.map((m: any) => (
              <div key={m.id}>
                <div className="flex flex-wrap justify-between gap-1 text-xs">
                  <span className="min-w-0 break-words">{nameOf(m.user_id)}</span>
                  <span className="break-words text-muted-foreground">
                    {formatCOP(m.paid)} / {formatCOP(m.assigned)} ·{" "}
                    <b className={m.pending === 0 ? "text-success" : "text-foreground"}>
                      {m.pending === 0 ? "al día" : `faltan ${formatCOP(m.pending)}`}
                    </b>
                  </span>
                </div>
                <Progress value={m.pct} className="mt-1 h-1.5" />
                {m.pending > 0 && (
                  <div className="mt-1 flex justify-end">
                    <WhatsAppButton
                      phone={profOf(m.user_id)?.phone}
                      variant="ghost"
                      label="Recordar por WhatsApp"
                      className="h-7 px-2 text-[11px]"
                      message={mensajeDeuda({
                        nombre: nameOf(m.user_id),
                        deuda: debt.name,
                        entidad: debt.entity,
                        pendiente: m.pending,
                        vence: debt.due_date,
                        dias,
                        status: status as any,
                        familia: familyName,
                      })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {necesitaComprobante && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-warning/20 p-3 text-xs text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              Falta el comprobante del pago total de la factura
              {vence ? ` · plazo hasta ${formatDate(vence)} ${vence.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : ""}.
            </span>
            {canPay && (
              <Button size="sm" variant="secondary" onClick={() => setOpenProof(true)}>Subir comprobante</Button>
            )}
          </div>
        )}

        {debt.settlement_proof_url && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            Pago total de la factura: <ProofLink path={debt.settlement_proof_url} label="Ver comprobante" />
          </div>
        )}

        {debt.document_url && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Soporte de la deuda{debt.document_note ? ` (${debt.document_note})` : ""}:{" "}
            <ProofLink path={debt.document_url} label="Ver extracto/factura" />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Vence: {formatDate(debt.due_date)}</span>
          <div className="flex flex-wrap gap-2">
            {canPay && status !== "pagada" && (
              <Button size="sm" variant="outline" onClick={() => setOpenPay(true)}>Registrar abono</Button>
            )}
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setOpenEdit(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    const ok = await confirmar({
                      title: "Eliminar deuda",
                      description: `Se eliminará "${debt.name}" y todos sus abonos. Esta acción no se puede deshacer.`,
                      confirmText: "Eliminar",
                      destructive: true,
                    });
                    if (!ok) return;
                    const { error } = await supabase.from("debts").delete().eq("id", debt.id);
                    if (error) return toast.error(error.message);
                    toast.success("Deuda eliminada");
                    onChange();
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                </Button>
              </>
            )}
          </div>
        </div>

        <Dialog open={openPay} onOpenChange={setOpenPay}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar abono — {debt.name}</DialogTitle></DialogHeader>
            <PaymentForm
              debt={debt}
              profiles={profiles}
              breakdown={breakdown}
              remaining={remaining}
              userId={userId}
              familyId={familyId}
              onDone={(saldo?: boolean) => {
                setOpenPay(false);
                onChange();
                if (saldo) setOpenProof(true);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Editar deuda</DialogTitle></DialogHeader>
            <DebtForm
              debt={debt}
              existingMembers={members}
              profiles={profiles}
              userId={userId}
              familyId={familyId}
              onDone={() => { setOpenEdit(false); onChange(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openProof} onOpenChange={setOpenProof}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader><DialogTitle>Comprobante del pago total</DialogTitle></DialogHeader>
            <SettlementProofForm
              debt={debt}
              userId={userId}
              familyId={familyId}
              profiles={profiles}
              enMora={status === "mora" || (dias !== null && dias < 0)}
              onDone={() => { setOpenProof(false); onChange(); }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function SettlementProofForm({ debt, userId, familyId, profiles, enMora, onDone }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [interes, setInteres] = useState("");
  const [responsable, setResponsable] = useState<string>(userId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Adjunta el comprobante del pago total");
    setLoading(true);
    try {
      const path = await uploadProof(userId, file);
      const { error } = await supabase
        .from("debts")
        .update({ settlement_proof_url: path, settlement_due_at: null, status: "pagada" })
        .eq("id", debt.id);
      if (error) throw error;

      const valorInteres = Number(interes || 0);
      if (valorInteres > 0) {
        const { error: expErr, queued } = await queuedWrite({
          table: "expenses",
          op: "insert",
          label: "Gasto por intereses de mora",
          payload: {
            amount: valorInteres,
            category: "otros",
            description: `Pago de intereses por mora de la deuda "${debt.name}"${debt.entity ? ` (${debt.entity})` : ""} — responsable del pago: ${
              profiles?.find((p: any) => p.id === responsable)?.name ?? "miembro"
            }`,
            expense_date: new Date().toISOString().slice(0, 10),
            paid_by: responsable,
            family_id: familyId,
          },
        });
        if (expErr) toast.error(expErr.message ?? "No se pudo registrar el interés en caja menor");
        else toast.success(queued ? "Interés guardado y pendiente de sincronizar" : "Interés por mora registrado en Caja Menor (categoría otros)");
      }

      toast.success("Comprobante guardado");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo guardar el comprobante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Adjunta la evidencia del pago total de la factura de <b>{debt.name}</b>. Quedará disponible en el historial.
      </p>
      <OcrScan
        title="Leer comprobante del pago total"
        hint="Toma o sube la foto del comprobante: se adjunta automáticamente y se leen sus datos."
        onFile={(f) => setFile(f)}
        onResult={() => {}}
      />
      <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file && <p className="text-xs text-muted-foreground">Adjunto: {file.name}</p>}

      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-sm">
          Interés por mora pagado <span className="text-muted-foreground">(opcional{enMora ? ", esta deuda estuvo en mora" : ""})</span>
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={interes}
          onChange={(e) => setInteres(e.target.value)}
        />
        {Number(interes || 0) > 0 && (
          <div>
            <Label className="text-xs">Responsable del pago del interés</Label>
            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Si registras un valor, se crea automáticamente un gasto en <b>Caja Menor</b> (categoría <b>otros</b>) con el
          concepto de pago de intereses por la deuda en mora a nombre del responsable.
        </p>
      </div>

      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar comprobante"}</Button></DialogFooter>
    </form>
  );
}

/** Suma meses conservando el día de vencimiento (ajusta al último día del mes cuando no existe). */
function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function DebtForm({ debt, existingMembers = [], profiles, onDone, userId, familyId }: any) {
  const editing = !!debt;
  const [type, setType] = useState<"unico" | "cuotas">(debt?.debt_type ?? "unico");
  const [split, setSplit] = useState<"porcentaje" | "fijo">("fijo");
  const [total, setTotal] = useState<string>(debt ? String(debt.total_amount) : "");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    existingMembers.forEach((m: any) => { init[m.user_id] = String(Number(m.amount_assigned ?? 0)); });
    return init;
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const totalN = Number(fd.get("total_amount"));
    const suma = Object.values(assign).reduce((s, v) => s + Number(v || 0), 0);
    if (split === "porcentaje") {
      if (suma > 0 && Math.abs(suma - 100) > 0.1) return toast.error(`Los porcentajes deben sumar 100% (van ${suma}%)`);
    } else if (suma - totalN > 0.5) {
      return toast.error("La suma de los valores asignados supera el total de la deuda");
    }
    setLoading(true);
    const totalCuotas = type === "cuotas" ? Number(fd.get("total_cuotas")) : null;
    let documentUrl: string | null = debt?.document_url ?? null;
    if (docFile) {
      try {
        documentUrl = await uploadProof(userId, docFile);
      } catch (err: any) {
        setLoading(false);
        return toast.error(err.message ?? "No se pudo subir el soporte de la deuda");
      }
    }
    const payload = {
      name: String(fd.get("name")),
      entity: String(fd.get("entity")),
      total_amount: totalN,
      debt_type: type,
      total_cuotas: totalCuotas,
      cuota_amount: type === "cuotas" && totalCuotas ? totalN / totalCuotas : null,
      due_date: String(fd.get("due_date")) || null,
      notes: String(fd.get("notes") || "") || null,
      document_url: documentUrl,
      document_note: String(fd.get("document_note") || "") || null,
      family_id: familyId,
    };

    let debtId = debt?.id as string | undefined;
    if (editing) {
      const { error } = await supabase.from("debts").update(payload).eq("id", debt.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      await supabase.from("debt_members").delete().eq("debt_id", debt.id);
    } else if (type === "cuotas" && totalCuotas && totalCuotas > 1) {
      // Una deuda por cada cuota, el mismo día de cada mes a partir del vencimiento.
      const primera = payload.due_date ?? new Date().toISOString().slice(0, 10);
      const valorCuota = totalN / totalCuotas;
      const asignaciones = Object.entries(assign).filter(([, v]) => Number(v) > 0);
      for (let i = 0; i < totalCuotas; i++) {
        const { data, error } = await supabase
          .from("debts")
          .insert({
            ...payload,
            name: `${payload.name} — cuota ${i + 1}/${totalCuotas}`,
            total_amount: valorCuota,
            total_cuotas: totalCuotas,
            cuota_amount: valorCuota,
            due_date: addMonths(primera, i),
            created_by: userId,
          })
          .select()
          .single();
        if (error || !data) { toast.error(error?.message ?? "Error creando las cuotas"); setLoading(false); return; }
        const filas = asignaciones.map(([uid, v]) => {
          const totalPersona = split === "porcentaje" ? (Number(v) / 100) * totalN : Number(v);
          return {
            debt_id: data.id,
            user_id: uid,
            percentage: totalN ? (totalPersona / totalN) * 100 : null,
            amount_assigned: totalPersona / totalCuotas,
          };
        });
        if (filas.length) {
          const { error: e2 } = await supabase.from("debt_members").insert(filas);
          if (e2) toast.error(e2.message);
        }
      }
      setLoading(false);
      toast.success(`Se crearon ${totalCuotas} deudas mensuales, una por cada cuota`);
      onDone();
      return;
    } else {
      const { data, error } = await supabase.from("debts").insert({ ...payload, created_by: userId }).select().single();
      if (error || !data) { toast.error(error?.message ?? "Error"); setLoading(false); return; }
      debtId = data.id;
    }

    const rows = Object.entries(assign)
      .filter(([, v]) => Number(v) > 0)
      .map(([uid, v]) => ({
        debt_id: debtId!,
        user_id: uid,
        percentage: split === "porcentaje" ? Number(v) : totalN ? (Number(v) / totalN) * 100 : null,
        amount_assigned: split === "porcentaje" ? (Number(v) / 100) * totalN : Number(v),
      }));
    if (rows.length) {
      const { error } = await supabase.from("debt_members").insert(rows);
      if (error) toast.error(error.message);
    }
    setLoading(false);
    toast.success(editing ? "Deuda actualizada" : "Deuda creada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input name="name" required defaultValue={debt?.name} /></div>
      <div><Label>Entidad</Label><Input name="entity" required placeholder="Banco, casa, etc." defaultValue={debt?.entity} /></div>
      <div>
        <Label>Valor total</Label>
        <Input name="total_amount" type="number" step="0.01" required value={total} onChange={(e) => setTotal(e.target.value)} />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unico">Pago único</SelectItem>
            <SelectItem value="cuotas">A cuotas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {type === "cuotas" && (
        <div>
          <Label># de cuotas</Label>
          <Input name="total_cuotas" type="number" min="1" required defaultValue={debt?.total_cuotas ?? ""} />
          {!editing && (
            <p className="mt-1 text-xs text-muted-foreground">
              Se creará una deuda por cada cuota, mes a mes, el mismo día que indiques como fecha de vencimiento
              (ej.: 3 cuotas desde agosto → agosto, septiembre y octubre). El valor y los responsables se reparten en cada cuota.
            </p>
          )}
        </div>
      )}
      <div><Label>Fecha de vencimiento</Label><Input name="due_date" type="date" defaultValue={debt?.due_date ?? ""} /></div>
      <div><Label>Notas</Label><Textarea name="notes" defaultValue={debt?.notes ?? ""} /></div>

      <div className="rounded-lg border p-3">
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Soporte de la deuda (extracto, factura o similar)
        </Label>
        <Input
          type="file"
          accept="image/*,application/pdf"
          className="mt-2"
          onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
        />
        <Input name="document_note" className="mt-2" placeholder="Descripción del soporte (opcional)" defaultValue={debt?.document_note ?? ""} />
        <p className="mt-1 text-xs text-muted-foreground">
          Sustenta los valores asignados a cada responsable. Queda visible para toda la familia y en el historial.
        </p>
        {editing && debt?.document_url && !docFile && (
          <p className="mt-1 text-xs text-muted-foreground">Ya hay un soporte adjunto; sube otro para reemplazarlo.</p>
        )}
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label>Responsables</Label>
          <Select value={split} onValueChange={(v) => { setSplit(v as any); setAssign({}); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fijo">Por valor fijo</SelectItem>
              <SelectItem value="porcentaje">Por porcentaje</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {profiles.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words text-sm">{p.name}</span>
              <Input
                type="number"
                min="0"
                max={split === "porcentaje" ? "100" : undefined}
                step="0.01"
                className="w-24 shrink-0 sm:w-28"
                placeholder="0"
                value={assign[p.id] ?? ""}
                onChange={(e) => setAssign((s) => ({ ...s, [p.id]: e.target.value }))}
              />
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground sm:w-24">
                {split === "porcentaje"
                  ? (total ? formatCOP((Number(assign[p.id] || 0) / 100) * Number(total)) : "$0")
                  : (total ? `${(((Number(assign[p.id] || 0)) / Number(total)) * 100 || 0).toFixed(1)}%` : "0%")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-xs text-muted-foreground">
          Suma: {split === "porcentaje"
            ? `${Object.values(assign).reduce((s, v) => s + Number(v || 0), 0)}%`
            : formatCOP(Object.values(assign).reduce((s, v) => s + Number(v || 0), 0))}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : editing ? "Guardar cambios" : "Crear deuda"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PaymentForm({ debt, profiles, breakdown, remaining, userId, familyId, onDone }: any) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<string>(userId);
  const [amount, setAmount] = useState<string>("");
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));

  const saldaDeuda = Number(amount || 0) >= remaining - 0.5 && Number(amount || 0) > 0;
  const responsable = breakdown.find((m: any) => m.user_id === target);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let proof_url: string | null = null;
    try {
      proof_url = await uploadProof(userId, file);
    } catch (err: any) {
      setLoading(false);
      return toast.error(err.message ?? "No se pudo subir el comprobante");
    }
    const { error, queued } = await queuedWrite({
      table: "payments",
      op: "insert",
      label: "Abono a deuda",
      payload: {
        debt_id: debt.id,
        user_id: target,
        created_by: userId,
        amount: Number(fd.get("amount")),
        payment_date: String(fd.get("payment_date")),
        proof_url,
        notes: String(fd.get("notes") || "") || null,
      },
    });
    if (error) { setLoading(false); return toast.error(error.message); }
    if (queued) {
      setLoading(false);
      toast.info("Sin conexión: el abono quedó guardado en este dispositivo y se enviará al recuperar la señal.");
      onDone(false);
      return;
    }

    if (saldaDeuda) {
      // El comprobante del abono NUNCA sirve como comprobante de liquidación:
      // siempre se exige aparte la evidencia del pago total de la factura.
      const limite = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("debts")
        .update({ status: "pagada", settled_at: new Date().toISOString(), settlement_due_at: limite })
        .eq("id", debt.id);
      await supabase.rpc("notify_family_admins", {
        _family_id: familyId,
        _type: "comprobante_pendiente",
        _message: `La deuda "${debt.name}" quedó saldada. Es obligatorio subir el comprobante del pago total de la factura antes de 24 horas.`,
        _related_id: debt.id,
      });
      toast.info("Falta el comprobante del pago total de la factura (obligatorio, máximo 24 horas).");
    }

    setLoading(false);
    toast.success("Abono registrado");
    onDone(saldaDeuda);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        Pendiente de la deuda: <b className="text-foreground">{formatCOP(remaining)}</b>
        {responsable && (
          <> · Pendiente de {profiles.find((p: any) => p.id === target)?.name ?? "esta persona"}:{" "}
            <b className="text-foreground">{formatCOP(responsable.pending)}</b></>
        )}
      </div>
      <OcrScan
        title="Leer comprobante del abono"
        hint="Toma o sube la foto de la transferencia: se adjunta y se llenan el monto y la fecha."
        onFile={(f) => setFile(f)}
        onResult={(d) => {
          if (d.amount) setAmount(String(d.amount));
          if (d.date) setFecha(d.date);
        }}
      />
      <div>
        <Label>Monto</Label>
        <Input name="amount" type="number" step="0.01" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <Label>Abono a nombre de</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">El monto se descuenta de lo asignado a esta persona.</p>
      </div>
      <div><Label>Fecha</Label><Input name="payment_date" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></div>
      <div>
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Comprobante del abono (opcional)
        </Label>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <p className="mt-1 text-xs text-muted-foreground">Adjunto: {file.name}</p>}
        {saldaDeuda && (
          <p className="mt-1 text-xs text-warning-foreground">
            Este abono salda la deuda: a continuación deberás adjuntar el <b>comprobante del pago total de la factura</b>
            {" "}(obligatorio). También se avisará al administrador con un plazo de 24 horas.
          </p>
        )}
      </div>
      <div><Label>Notas</Label><Textarea name="notes" /></div>
      <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar abono"}</Button></DialogFooter>
    </form>
  );
}
