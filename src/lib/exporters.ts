import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type Row = Record<string, any>;
export interface Sheet { name: string; rows: Row[] }

function slug(s: string) {
  return (s || "hogarfin").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").toLowerCase();
}

/** Exporta una o varias hojas a un archivo .xlsx real. */
export function exportExcel(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Sin_datos: "" }]);
    const cols = Object.keys(s.rows[0] ?? { Sin_datos: "" });
    ws["!cols"] = cols.map((c) => ({
      wch: Math.min(40, Math.max(c.length + 2, ...s.rows.map((r) => String(r[c] ?? "").length + 2), 10)),
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${slug(filename)}.xlsx`);
}

/** Exporta tablas a PDF con encabezado del hogar. */
export function exportPDF(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  kpis?: { label: string; value: string }[];
  tables: { name: string; rows: Row[] }[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(opts.title, 40, 42);
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (opts.subtitle) doc.text(opts.subtitle, 40, 60);
  doc.text(new Date().toLocaleString("es-CO"), width - 40, 60, { align: "right" });
  doc.setTextColor(0);

  let y = 82;
  if (opts.kpis?.length) {
    autoTable(doc, {
      startY: y,
      head: [opts.kpis.map((k) => k.label)],
      body: [opts.kpis.map((k) => k.value)],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [22, 122, 84], textColor: 255 },
    });
    y = (doc as any).lastAutoTable.finalY + 22;
  }

  opts.tables.forEach((t) => {
    const cols = Object.keys(t.rows[0] ?? {});
    doc.setFontSize(12);
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 50; }
    doc.text(t.name, 40, y);
    autoTable(doc, {
      startY: y + 8,
      head: [cols.length ? cols : ["Sin datos"]],
      body: t.rows.length ? t.rows.map((r) => cols.map((c) => String(r[c] ?? ""))) : [["Sin datos"]],
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [22, 122, 84], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    y = (doc as any).lastAutoTable.finalY + 26;
  });

  doc.save(`${slug(opts.filename)}.pdf`);
}

export function exportCSV(filename: string, rows: Row[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(filename)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
