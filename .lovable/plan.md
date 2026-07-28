## HogarFin — Organizador Familiar de Finanzas

App móvil-first en español para que familias gestionen deudas, ahorros, gastos y notificaciones.

### Stack
React + TanStack Start (plantilla actual) + Lovable Cloud (Supabase) + Tailwind + shadcn/ui + Recharts + sonner (notificaciones in-app).

---

### Fase 1 — Backend (Lovable Cloud)

**Activar Lovable Cloud**, luego migración SQL con:

- `profiles` (id, email, name, avatar_url) — sincronizada con `auth.users` vía trigger.
- `app_role` enum: `admin | miembro | invitado` + tabla `user_roles` (patrón seguro con `has_role()` SECURITY DEFINER).
- `debts`, `debt_members`, `payments` (con `proof_url` a Storage), `savings_goals`, `savings_contributions`, `expenses`, `notifications`, `activity_log`.
- Bucket Storage `comprobantes` para fotos de abonos.
- RLS en todas las tablas:
  - Admin: full access.
  - Miembro: lee todo lo familiar, escribe solo lo propio (abonos, aportes, gastos).
  - Invitado: solo SELECT.
- Triggers para: crear notificación al insertar deuda/abono/meta completada; registrar en `activity_log`; actualizar `current_amount` de metas y `status` de deudas.
- `pg_cron` diario que revisa vencimientos y crea notificaciones "por vencer en 3 días" / "en mora".

### Fase 2 — Auth y Layout

- Página `/auth` (login + registro email/password). Primer usuario registrado = admin automático.
- Layout con sidebar (shadcn) colapsable mobile-first: Dashboard, Deudas, Calendario, Ahorros, Caja Menor, Reportes, Historial, Miembros (admin).
- Rutas protegidas bajo `_authenticated/` (gate gestionado por integración Supabase).
- Header con campana de notificaciones (badge con no-leídas) + avatar.

### Fase 3 — Módulos

**A. Deudas** (`/deudas`)
- Lista con filtros (entidad, persona, estado) y badges de estado (Al día / Por vencer / Mora / Pagada).
- Dialog crear/editar deuda (admin) con asignación de % por miembro (validación suma = 100%).
- Detalle de deuda: cuotas, responsables, historial de abonos, botón "Registrar abono" con upload de comprobante.

**B. Calendario** (`/calendario`)
- Vista mensual con fechas de pago coloreadas (amarillo ≤3 días, rojo en mora, verde pagada).
- Click en día → lista de deudas de esa fecha.

**C. Ahorros** (`/ahorros`)
- Cards de metas con barra de progreso, monto faltante, fecha objetivo.
- Botón "Aportar" (cualquier miembro).
- Sección "Reto semanal" destacada.

**D. Caja Menor** (`/caja-menor`)
- Tabla de gastos + botón agregar (categoría, monto, fecha, descripción).
- Resumen mensual por categoría.

**E. Reportes** (`/reportes`)
- Dashboard admin: KPIs (deuda total, ahorro total, próximos 3 pagos), gráfica barra por entidad, gráfica pie por persona.
- Vista por persona: cuánto debe / abonado / % avance.
- Exportar Excel (`xlsx`) y PDF (`jspdf` + `jspdf-autotable`).

**F. Historial** (`/historial`)
- Feed cronológico read-only de `activity_log`.

**G. Miembros** (`/miembros`, admin)
- Lista de usuarios, cambiar rol, ver avatar.

### Fase 4 — Notificaciones gratis

- **In-app** (sonner + campana): via Supabase Realtime suscrito a `notifications` del usuario. 100% gratis.
- **Push web** opcional: Notification API del navegador cuando llega un evento realtime (sin servicios externos).
- Triggers de BD cubren: nueva deuda, abono registrado, meta completada.
- `pg_cron` cubre: 3 días para vencer, mora.

### Fase 5 — Diseño

Sistema visual cálido/familiar (no genérico SaaS azul):
- Paleta verde-esmeralda (finanzas sanas) + acentos coral para alertas, sobre fondo crema claro / navy oscuro.
- Tipografía: Plus Jakarta Sans (headings) + Inter (body).
- Tokens semánticos en `styles.css` con oklch. Variantes: `success`, `warning`, `danger` para estados de deuda.
- Cards con radio generoso, sombras suaves, iconos lucide.

### Detalles técnicos

- Todos los datos vía `createServerFn` con `requireSupabaseAuth`.
- Roles verificados server-side con `has_role()`.
- Uploads: `supabase.storage.from('comprobantes').upload()` desde cliente (RLS en bucket).
- SEO/head por ruta con títulos en español.
- Sin modo oscuro toggle (fuera de alcance inicial).

### Alcance de la primera entrega

Fase 1 + 2 + 3 (A, C, D, E dashboard básico) + 4 (in-app). Calendario, reportes avanzados (export PDF/Excel), historial completo y miembros se entregan a continuación si el plan se aprueba tal cual — o en una segunda tanda si prefieres priorizar.

¿Apruebo y comienzo, o quieres ajustar algo (paleta, priorización de módulos, roles)?