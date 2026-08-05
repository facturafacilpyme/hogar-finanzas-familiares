export type Role = "admin" | "miembro" | "invitado" | "educativo";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  miembro: "Miembro",
  invitado: "Invitado",
  educativo: "Educativo (hijos)",
};

export const ROLE_HELP: Record<Role, string> = {
  admin: "Control total: deudas, gastos, metas, miembros y reportes.",
  miembro: "Registra abonos, gastos y aportes; consulta todo el hogar.",
  invitado: "Solo lectura de la información del hogar.",
  educativo: "Modo aprendizaje: metas de ahorro guiadas y aportes, sin tocar las deudas ni la caja menor.",
};

/** Puede crear/editar deudas, abonos y gastos de caja menor. */
export function canWriteFinance(role?: string | null) {
  return role === "admin" || role === "miembro";
}

/** Puede aportar a metas de ahorro (incluye el rol educativo). */
export function canSave(role?: string | null) {
  return role === "admin" || role === "miembro" || role === "educativo";
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

/** Rol infantil / educativo. */
export function isEducativo(role?: string | null) {
  return role === "educativo";
}
