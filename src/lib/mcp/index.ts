import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFamilies from "./tools/list-families";
import listDebts from "./tools/list-debts";
import listPayments from "./tools/list-payments";
import listSavingsGoals from "./tools/list-savings-goals";
import listExpenses from "./tools/list-expenses";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "hogar-finanzas-familiares",
  title: "Hogar Finanzas Familiares",
  version: "0.1.0",
  instructions:
    "Consulta las finanzas de las familias de HogarFin del usuario: deudas con saldo pendiente, abonos, metas de ahorro y gastos de Caja Menor. Si el usuario pertenece a varias familias, primero lista sus familias y pasa family_id. Los montos están en pesos colombianos (COP).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFamilies, listDebts, listPayments, listSavingsGoals, listExpenses],
});
