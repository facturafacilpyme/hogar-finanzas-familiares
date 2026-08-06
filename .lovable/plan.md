## HogarFin — pendientes

El modelo multi-familia del plan anterior **está implementado y en uso** (tablas `families` /
`family_members`, `family_id` en todo el dominio, RLS por familia, alta con familia propia o por
invitación, selector de familia en el encabezado y página "Mi familia"). Ese plan queda cerrado.

Lo que sigue abierto de la última tanda de mejoras:

### 1. Estrategia de desendeudamiento (Reportes / Deudas)
`src/lib/strategy.ts` ya tiene `construirPlan` (Bola de Nieve vs. Avalancha) pero **no está
conectado a ninguna pantalla**. Falta la pestaña en Reportes que muestre ambos planes, el orden
sugerido de pago y el ahorro estimado en intereses.

### 2. Reparto de deuda por ingresos
`family_members.monthly_income` existe en la base de datos pero no se captura ni se usa.
Falta: campo de ingreso mensual en "Mi familia" y botón "Calcular % por ingresos" al asignar
responsables de una deuda.

### 3. Gamificación de Ahorros
En la base ya existen `badges`, `savings_goals.is_challenge`, `goal_kind`, `period_start` y
`period_end`, pero la página de Ahorros no los usa. Falta:
- Retos semanales colectivos (crear reto con periodo y meta común).
- Ranking de aportantes y entrega automática de insignias.
- Fondo de Reserva Familiar como `goal_kind` especial, con regla de uso para cubrir la cuota de un
  miembro en emergencia.

### 4. Acciones rápidas en notificaciones
`NotificationBell` solo marca como leído y navega. Falta el botón de un toque
(p. ej. "Registrar abono" / "Ver deuda") según `type` y `related_id`.

### 5. OCR fuera de Caja Menor
`OcrScan` solo está en el registro de gastos. Pendiente reutilizarlo al registrar abonos y al subir
el comprobante de pago total de una deuda.

### 6. Paginación / scroll infinito
Deudas, Abonos e Historial cargan todo de una (Historial con `limit(500)`). Falta paginación o
carga incremental cuando el volumen crezca.

### Decisiones abiertas
- ¿El Fondo de Reserva descuenta automáticamente de la deuda del miembro cubierto, o solo queda
  registrado como aporte y el ajuste se hace a mano?
- ¿Las insignias se otorgan desde el cliente al cumplir la meta, o con un trigger en la base?
- ¿Los retos semanales se cierran solos al terminar el periodo o los cierra el admin?
