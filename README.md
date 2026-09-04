# HogarFin — Organizador Familiar de Finanzas

Aplicación web (PWA) mobile-first en español para que **varias familias** controlen sus deudas,
abonos, gastos y metas de ahorro de forma aislada entre sí.

Stack real: **React 19 + TanStack Start (Vite 7) + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase)**.
No usa React Router ni edge functions: el backend propio son *server functions* (`createServerFn`)
y triggers/funciones SQL.

---

## 1. Multi-tenant vs global

**Aislado por familia (`family_id` + RLS):**
`debts`, `debt_members`, `payments`, `expenses`, `budgets`, `savings_goals`,
`savings_contributions`, `savings_goal_members`, `badges`, `invitations`,
`activity_log`, `notifications` y `family_members`.

**Global / por usuario:**
- `auth.users` y `profiles` (un perfil por usuario; visible para quienes comparten familia con él).
- `notifications` son por usuario (`user_id`), aunque llevan además `family_id`.
- La familia activa se guarda en `localStorage` (`hogarfin_family_id`) y se puede cambiar con el
  selector del encabezado cuando el usuario pertenece a más de una familia.

**Alta de usuarios:** el trigger `handle_new_user` crea el perfil y, si hay una invitación vigente
para ese correo, lo mete en esa familia con el rol invitado; si no, le crea su propia familia
(`"Familia de {nombre}"`) y lo deja como `admin`. `redeem_invitation(token)` permite aceptar una
invitación ya estando registrado y borra la familia propia si quedó vacía.

---

## 2. Roles reales y permisos (según RLS actual)

Enum `app_role`: `admin`, `miembro`, `invitado`, `educativo`.

| Acción | admin | miembro | educativo | invitado |
|---|---|---|---|---|
| Ver todo lo de su familia | Sí | Sí | Sí | Sí |
| Crear / editar / borrar deudas y responsables | Sí | No | No | No |
| Registrar abonos (`payments`) | Sí | Sí | No | No |
| Editar/borrar abonos | propios o cualquiera de la familia | solo los propios | No | No |
| Registrar gastos de Caja Menor | Sí | Sí | No | No |
| Editar/borrar gastos | cualquiera | solo los propios | No | No |
| Definir presupuestos por categoría | Sí | No | No | No |
| Crear metas de ahorro | Sí | Sí | No | No |
| Editar / romper / borrar metas | Sí | No | No | No |
| Aportar o retirar en metas (`savings_contributions`) | Sí | Sí | **Sí** | No |
| Unirse/asignarse a una meta | Sí | Sí | **Sí** | No |
| Renombrar familia, gestionar miembros, roles e invitaciones | Sí | No | No | No |

Funciones SECURITY DEFINER que implementan esto:
`is_family_member`, `is_family_admin`, `can_write_family` (admin+miembro),
`can_save_family` (admin+miembro+educativo), `family_role`.
Helpers equivalentes en frontend: `src/lib/permissions.ts`.

---

## 3. Módulos que existen hoy

Rutas públicas: `/` (landing), `/auth` (email+contraseña y recuperación),
`/reset-password`, `/invitacion/$token`.
Rutas protegidas bajo `src/routes/_authenticated/`:

- **Panel** (`/panel`) — totales del hogar, deuda pendiente por persona, alertas predictivas de
  riesgo de mora (con nivel de riesgo, 5 días antes), balance semanal compartible por WhatsApp.
  El mensaje urgente de intereses solo lo ve el admin.
- **Deudas** (`/deudas`) — crear/editar/eliminar deudas, tipo único o a cuotas (las cuotas generan
  una deuda por mes), reparto por porcentaje o por valor fijo, filtros y ordenamiento
  (fecha, nombre, valor), estado calculado (activa / por vencer / mora / pagada), comprobante de
  factura, y **comprobante de pago total obligatorio** con plazo de 24 h al marcar como pagada.
  El interés por mora pagado se registra como gasto en Caja Menor.
- **Abonos** (`/abonos`) — listado de abonos con comprobante, edición y borrado según rol,
  totales por persona.
- **Calendario** (`/calendario`) — vencimientos del mes con semáforo y alertas de riesgo de mora.
- **Ahorros** (`/ahorros`) — metas con progreso, aportes y retiros con comprobante, miembros por
  meta, romper/restaurar meta (admin), **retos colectivos** (`is_challenge`, `period_start`/
  `period_end`) con cierre automático diario (`close_expired_challenges` + pg_cron) y fallback en
  UI, **insignias** otorgadas por trigger en la base (`award_badges`, idempotente por
  `UNIQUE(user_id, code, goal_id)`) y **Fondo de Reserva** (`goal_kind = 'reserva'`) con botón
  "Usar fondo" que ejecuta la función transaccional `use_reserve_for_debt` (retiro + abono en una
  sola transacción).
- **Caja Menor** (`/caja-menor`) — gastos por categoría (`mercado`, `transporte`, `salud`,
  `servicios`, `otros`), **presupuestos mensuales por categoría** con semáforo verde/amarillo/rojo
  y aviso al superar el 90 %, y **lectura OCR de recibos** (server function con Lovable AI).
- **Reportes** (`/reportes`) — gráficas (recharts) y exportación a **Excel, PDF y CSV**.
- **Historial** (`/historial`) — log de actividad de la familia (triggers `log_activity`).
- **Mi familia** (`/miembros`) — renombrar familia, ver miembros, cambiar roles, generar y revocar
  invitaciones (7 días), eliminar miembros (`purgeFamilyMember`).
- **Mi cuenta** (`/cuenta`) — nombre, teléfono y datos del perfil.

Transversal: notificaciones en campana con realtime y **acciones rápidas de un toque**
(`NotificationBell`: "Ver deuda", "Registrar abono", "Subir comprobante" → `/deudas?debtId`;
"Ver abonos" → `/abonos?debtId`; "Ver meta" → `/ahorros?goalId`; marcan la notificación como leída
individualmente y avisan sin navegar si no hay registro asociado), pop-up de recordatorios por rol
(`ReminderPopup`), avisos por WhatsApp (`wa.me`, sin costo), cola de sincronización offline en
IndexedDB con indicador (`SyncStatus`), diálogos de confirmación propios (sin `alert`/`confirm`),
instalación como PWA.

El modelo **multi-familia** está cerrado: todo el dominio va aislado por `family_id` con RLS,
alta con familia propia o por invitación, selector de familia y página "Mi familia".

---

## 4. Esquema de base de datos actual

**Enums**
- `app_role`: admin, miembro, invitado, educativo
- `debt_status`: activa, pagada, mora
- `debt_type`: unico, cuotas
- `expense_category`: mercado, transporte, salud, servicios, otros
- `notif_type`: nueva_deuda, por_vencer, en_mora, abono_registrado, meta_completada,
  pago_total_pendiente, riesgo_mora

**Tablas**

| Tabla | Columnas propias del dominio |
|---|---|
| `families` | name, created_by |
| `family_members` | family_id, user_id, role, monthly_income |
| `profiles` | id (= auth.users), email, name, avatar_url, phone |
| `invitations` | family_id, token, role, email, name, created_by, accepted_by, accepted_at, expires_at |
| `debts` | family_id, name, entity, total_amount, debt_type, total_cuotas, current_cuota, cuota_amount, interest_rate, due_date, created_date, status, notes, document_url, document_note, settlement_proof_url, settled_at, settled_by, settlement_due_at, created_by |
| `debt_members` | debt_id, user_id, family_id, percentage, amount_assigned |
| `payments` | debt_id, user_id, family_id, amount, payment_date, proof_url, notes, created_by |
| `expenses` | family_id, category, amount, expense_date, description, paid_by |
| `budgets` | family_id, category, monthly_limit |
| `savings_goals` | family_id, name, target_amount, current_amount, due_date, is_challenge, goal_kind, period_start, period_end, broken_at, created_by |
| `savings_goal_members` | goal_id, user_id, family_id |
| `savings_contributions` | goal_id, user_id, family_id, amount, kind (aporte/retiro), contribution_date, proof_url, notes, created_by |
| `badges` | family_id, user_id, code, label, goal_id |
| `notifications` | user_id, family_id, type, message, read, related_id |
| `activity_log` | family_id, user_id, action, entity, entity_id, details |

Todas tienen RLS activa y `GRANT` para `authenticated`/`service_role`.

**Triggers y funciones destacadas**
- `handle_new_user` (alta + familia/invitación), `redeem_invitation`, `invitation_info`.
- `log_activity` en deudas, abonos, gastos, metas, aportes, miembros, invitaciones y familias.
- `notify_new_debt_member`, `notify_payment`, `notify_family_admins`.
- `recalc_goal_amount` / `update_goal_on_contribution` (saldo de metas).
- `set_family_from_debt`, `set_family_from_goal`, `set_family_from_goal_member` (autocompletan `family_id`).
- `set_updated_at`.
- `award_badges` (trigger AFTER INSERT en `savings_contributions`: primer aporte, meta completada,
  reto completado).
- `use_reserve_for_debt(goal_id, debt_id, user_id, amount)` (uso del Fondo de Reserva: retiro +
  abono en una sola transacción, solo admin).
- `close_expired_challenges` (job diario de pg_cron que cierra retos vencidos y otorga insignias).

**Storage:** bucket privado `comprobantes` para facturas y comprobantes de pago/aporte.

---

## 5. Desarrollo

```sh
npm i
npm run dev
```

Continúa en el [editor de Lovable](https://lovable.dev/projects/813cb785-e00e-4a30-8f7a-2220bebe4302).
