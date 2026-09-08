# Categorías de gasto personalizables por familia

Hoy las cinco categorías (mercado, transporte, salud, servicios, otros) están fijas en la base de
datos y son iguales para todas las familias. Se vuelven una lista propia de cada hogar.

## Qué cambia para ti

- Nueva sección "Categorías" en Caja Menor donde se pueden **crear, renombrar y desactivar** los
  ítems (por ejemplo: "Arriendo", "Colegio", "Mascotas", "Gasolina").
- Cada familia arranca con las cinco categorías actuales ya creadas, así que nada se pierde ni
  cambia de golpe; desde ahí cada quien las ajusta a su manera.
- La lista personalizada aparece en los tres sitios: al registrar un gasto, al fijar los límites
  mensuales del presupuesto y en los filtros/resúmenes de consumo.
- Pueden editarla el Admin y los miembros (los invitados solo ven).
- Una categoría que ya tenga gastos no se borra: se **desactiva**, así el historial y los reportes
  anteriores siguen cuadrando. Si no tiene gastos ni presupuesto, se elimina de verdad.
- Renombrar una categoría actualiza también los gastos ya registrados con ese nombre.

## Cambios en la base de datos

1. Nueva tabla `expense_categories`: `family_id`, `name`, `slug`, `active`, `sort_order`,
   `created_at`, `updated_at`. Único por `(family_id, slug)`. GRANT para `authenticated` y
   `service_role`; RLS: lectura para miembros de la familia (`is_family_member`), escritura para
   `can_write_family` (admin y miembro). Trigger `set_updated_at`.
2. Semilla: insertar las cinco categorías actuales para cada familia existente y crear un trigger
   `AFTER INSERT ON public.families` que las cree en toda familia nueva.
3. `expenses.category` y `budgets.category` pasan de `expense_category` (enum) a `text`, con los
   valores actuales conservados tal cual (`ALTER ... TYPE text USING category::text`). Se mantiene
   `NOT NULL`; se añade índice único en `budgets(family_id, category)` si no existe. El tipo enum
   `expense_category` queda sin uso (se elimina al final de la migración).

No se tocan deudas, ahorros ni notificaciones.

## Cambios en la aplicación

`src/routes/_authenticated/caja-menor.tsx`:
- Quitar la constante fija `CATEGORIAS` y cargar `expense_categories` de la familia junto con
  gastos y presupuestos; usar esa lista en el filtro, los selectores de gasto (nuevo y edición),
  el formulario de presupuesto y el cálculo de consumo por categoría (`limiteOf`, totales, barras
  verde/amarillo/rojo).
- Nuevo diálogo "Categorías": lista con nombre editable, botón para añadir, y acción de
  desactivar/eliminar según si tiene movimientos. Reutiliza `Dialog`, `Input`, `Button`,
  `useConfirm` y `toast` como el resto de la pantalla. Visible solo para admin y miembro
  (`src/lib/permissions.ts`).
- Si un gasto antiguo tiene una categoría ya desactivada, se sigue mostrando su nombre y aparece
  en los resúmenes; solo no se ofrece para gastos nuevos.

`src/routes/_authenticated/reportes.tsx` y cualquier otro punto que asuma las cinco categorías
fijas: usar la lista cargada desde la base de datos.

## Pendientes previos (sin tocar en este turno)

- Gamificación de Ahorros: ranking por reto con barras animadas e insignias por miembro.
- Paginación / scroll infinito en Deudas, Abonos e Historial.
