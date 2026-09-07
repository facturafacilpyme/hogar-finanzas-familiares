# HogarFin — pendientes

Completado (no volver a planear): reparto de deuda por ingresos — campo "Ingreso mensual" por
miembro en "Mi familia" (`family_members.monthly_income`) y botón "Calcular % por ingresos" en el
formulario de deuda, que reparte porcentaje o valor fijo en proporción al ingreso declarado.

## 1. Gamificación de Ahorros (resto de UI)
Falta pulir `src/routes/_authenticated/ahorros.tsx`: ranking de aportantes por reto con barras de
progreso animadas y presentación de insignias por miembro.

## 2. Paginación / scroll infinito
Deudas, Abonos e Historial cargan todo de una (Historial con `limit(500)`). Falta paginación o
carga incremental cuando el volumen crezca.
