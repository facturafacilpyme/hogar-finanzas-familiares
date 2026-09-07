# HogarFin — pendientes

Completado y cerrado (no volver a planear): modelo multi-familia, decisiones y implementación de
Fondo de Reserva (`use_reserve_for_debt`), insignias (`award_badges`), cierre de retos con pg_cron,
y acciones rápidas en notificaciones (`NotificationBell` con navegación a Deudas/Abonos/Ahorros).

## 1. Reparto de deuda por ingresos
`family_members.monthly_income` existe en la base pero no se captura ni se usa. Falta: campo de
ingreso mensual en "Mi familia" y botón "Calcular % por ingresos" al asignar responsables de una
deuda.

## 2. Gamificación de Ahorros (resto de UI)
La base (insignias, retos, fondo de reserva) ya está implementada. Falta pulir la experiencia en
`src/routes/_authenticated/ahorros.tsx`: ranking de aportantes por reto con barras de progreso
animadas y presentación de insignias por miembro.

## 3. Paginación / scroll infinito
Deudas, Abonos e Historial cargan todo de una (Historial con `limit(500)`). Falta paginación o
carga incremental cuando el volumen crezca.
