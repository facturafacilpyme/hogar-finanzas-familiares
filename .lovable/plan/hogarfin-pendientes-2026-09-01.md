## HogarFin — pendientes

El modelo multi-familia del plan anterior **está implementado y en uso** (tablas `families` /
`family_members`, `family_id` en todo el dominio, RLS por familia, alta con familia propia o por
invitación, selector de familia en el encabezado y página "Mi familia"). Ese plan queda cerrado.

### Decisiones cerradas (aprobadas)
1. **Fondo de Reserva:** el uso del fondo para cubrir la cuota de un miembro descuenta
   automáticamente de su deuda mediante una función transaccional de Postgres
   (`use_reserve_for_debt`) que inserta el retiro en `savings_contributions` y el abono en
   `payments` en una sola transacción; los triggers existentes recalculan saldos y
   `activity_log` audita ambos movimientos. Revertir = borrar ambas filas.
2. **Insignias:** se otorgan con un trigger en la base al insertar `savings_contributions`
   (función `award_badges`), con constraint `UNIQUE(user_id, code, goal_id)` en `badges` e
   `INSERT ... ON CONFLICT DO NOTHING` para idempotencia ante aportes simultáneos.
3. **Retos semanales:** cierre automático con job diario de pg_cron que marca cerrados los
   retos con `period_end` vencido y otorga las insignias del reto; la UI además trata como
   cerrado cualquier reto vencido aunque el job no haya corrido (lazy fallback). Las disputas
   se resuelven editando/borrando aportes, no controlando el cierre.

Lo que sigue abierto:

### 1. Estrategia de desendeudamiento (Reportes / Deudas)
`src/lib/strategy.ts` ya tiene `construirPlan` (Bola de Nieve vs. Avalancha) pero **no está
conectado a ninguna pantalla**. Falta la pestaña en Reportes que muestre ambos planes, el orden
sugerido de pago y el ahorro estimado en intereses.

### 2. Reparto de deuda por ingresos
`family_members.monthly_income` existe en la base de datos pero no se captura ni se usa.
Falta: campo de ingreso mensual en "Mi familia" y botón "Calcular % por ingresos" al asignar
responsables de una deuda.

### 3. Gamificación de Ahorros (siguiente a implementar — decisiones ya cerradas arriba)
En la base ya existen `badges`, `savings_goals.is_challenge`, `goal_kind`, `period_start` y
`period_end`, pero la página de Ahorros no los usa. Alcance:
- **Migración:**
  - `UNIQUE(user_id, code, goal_id)` en `badges`.
  - Función `award_badges()` + trigger AFTER INSERT en `savings_contributions` (meta individual
    completada, primer aporte, reto completado).
  - Función transaccional `use_reserve_for_debt(goal_id, debt_id, user_id, amount)` con
    validaciones (fondo existe, `goal_kind = 'reserva'`, miembro de la familia, saldo
    suficiente) que inserta el retiro y el abono con `notes = 'Cubierto por Fondo de Reserva'`.
  - Columna `closed_at timestamptz` en `savings_goals` para retos + job pg_cron diario que
    cierra retos vencidos y otorga insignias del reto al/ a los mayores aportantes.
- **UI Ahorros (`src/routes/_authenticated/ahorros.tsx`):**
  - Crear reto semanal colectivo (periodo + meta común) y Fondo de Reserva como `goal_kind`
    especial.
  - Ranking de aportantes por reto con barras de progreso animadas.
  - Sección de insignias ganadas por miembro.
  - Botón "Usar fondo" en el Fondo de Reserva: elige deuda + miembro + monto y llama a
    `use_reserve_for_debt`; confirmación con `ConfirmDialog`.
  - Retos vencidos se muestran cerrados aunque `closed_at` sea null (lazy fallback).

### 4. Acciones rápidas en notificaciones
`NotificationBell` solo marca como leído y navega. Falta el botón de un toque
(p. ej. "Registrar abono" / "Ver deuda") según `type` y `related_id`.

### 5. OCR fuera de Caja Menor
`OcrScan` solo está en el registro de gastos. Pendiente reutilizarlo al registrar abonos y al subir
el comprobante de pago total de una deuda.

### 6. Paginación / scroll infinito
Deudas, Abonos e Historial cargan todo de una (Historial con `limit(500)`). Falta paginación o
carga incremental cuando el volumen crezca.
