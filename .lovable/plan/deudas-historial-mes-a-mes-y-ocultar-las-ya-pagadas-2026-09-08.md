# Deudas: historial mes a mes y ocultar las ya pagadas

## Qué cambia para ti

1. **Las deudas en cero desaparecen de la vista principal.** Al entrar a Deudas verás por defecto
   solo lo que aún debes. Las pagadas siguen disponibles eligiendo "Pagadas" o "Todas" en el filtro
   que ya existe.

2. **Navegación mes a mes.** Arriba de la lista aparece un selector de mes con flechas
   (‹ Septiembre 2026 ›) más la opción "Todos los meses". Al elegir un mes se muestran solo las
   deudas que vencen en ese mes, con un resumen del mes: total, abonado y pendiente.
   Esto sirve como historial: puedes retroceder a meses anteriores y ver qué se debía y cuánto se
   pagó, incluidas las cuotas mensuales generadas por las deudas a cuotas.

3. Las deudas sin fecha de vencimiento se agrupan aparte como "Sin fecha" y siempre se muestran
   cuando el selector está en "Todos los meses".

## Detalle técnico

Todo el cambio es de interfaz en `src/routes/_authenticated/deudas.tsx`; no toca la base de datos
ni la lógica de saldos.

- Cambiar el valor inicial de `filterStatus` de `"todos"` a `"pendientes"` y añadir esa opción al
  `Select` ("Pendientes (sin pagadas)"), que incluye `activa`, `por_vencer` y `mora` según
  `debtStatus()` de `src/lib/debts.ts`. Se conservan las opciones actuales.
- Nuevo estado `mesRef: Date | null` (null = todos los meses) con dos `Button` de flecha y la
  etiqueta del mes, reutilizando el patrón de `calendario.tsx` (arreglo `MESES`, `ChevronLeft` /
  `ChevronRight`) y un botón para volver a "Todos los meses".
- El `useMemo` de `filtered` añade el filtro por mes comparando año y mes de `debt.due_date`.
- Encima de la lista, una `Card` de resumen del mes seleccionado: total (`total_amount`), abonado
  (suma de `payments` de esas deudas) y pendiente, formateados con `formatCOP`.
- Cuando hay mes seleccionado y no hay resultados, el mensaje vacío indica el mes en cuestión.

## Pendientes del plan anterior (sin tocar en este turno)

- Gamificación de Ahorros: ranking de aportantes por reto con barras animadas e insignias por
  miembro en `src/routes/_authenticated/ahorros.tsx`.
- Paginación / scroll infinito en Deudas, Abonos e Historial.
