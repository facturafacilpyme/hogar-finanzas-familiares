# HogarFin — pendientes

## 1. Reparto de deuda por ingresos (en curso)

Objetivo: que el admin pueda declarar el ingreso mensual de cada miembro y repartir una deuda
automáticamente en proporción a esos ingresos.

**Mi familia (`/miembros`)**
- En cada miembro, campo "Ingreso mensual" (solo admin) junto al rol y al WhatsApp, con botón
  guardar que actualiza `family_members.monthly_income`.
- Mostrar el valor en formato pesos y permitir 0 (sin ingreso declarado).

**Deudas (`/deudas`, formulario de deuda)**
- Botón "Calcular % por ingresos" encima de la lista de responsables.
- Toma los ingresos de los miembros ya marcados con valor asignado; si ninguno tiene valor,
  usa a todos los miembros de la familia con ingreso > 0.
- Reparte el total de la deuda proporcionalmente al ingreso de cada uno y rellena los campos
  del reparto según el modo activo (porcentaje o valor fijo), redondeando el último para que
  la suma cuadre exactamente.
- Si nadie tiene ingreso declarado, avisa con un mensaje y enlaza a "Mi familia".

Sin cambios de base de datos: la columna `monthly_income` ya existe con RLS.

## 2. Gamificación de Ahorros (resto de UI)
Falta pulir `src/routes/_authenticated/ahorros.tsx`: ranking de aportantes por reto con barras de
progreso animadas y presentación de insignias por miembro.

## 3. Paginación / scroll infinito
Deudas, Abonos e Historial cargan todo de una (Historial con `limit(500)`). Falta paginación o
carga incremental cuando el volumen crezca.
