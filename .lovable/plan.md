# HogarFin — completar acciones rápidas en notificaciones

El trabajo quedó a medias y hoy la aplicación no compila. Este plan cierra lo pendiente.

## Estado verificado

- La compilación falla con dos errores de tipos: los enlaces "Registrar abono" de
  `panel.tsx` (línea 204) y `calendario.tsx` (línea 173) apuntan a Deudas, que ahora exige
  parámetros de búsqueda.
- Deudas ya acepta `?debtId`, resalta la deuda y hace scroll hacia ella.
- Abonos ya lee `?debtId`, pero todavía no aplica ese valor al filtro de deuda.
- Ahorros no acepta ningún parámetro de navegación (`goalId`).
- `NotificationBell` aún no tiene botones de acción: solo lista mensajes y "Marcar leídas".

## Qué se va a construir

### 1. Reparar la compilación
Actualizar los dos enlaces a Deudas del Panel y del Calendario para que envíen la deuda
correspondiente, de modo que al tocarlos se abra Deudas ya posicionada en esa deuda.

### 2. Filtro por deuda en Abonos
Cuando se llegue a Abonos con una deuda indicada, el filtro de deuda queda preseleccionado.
Si la deuda ya no existe, se muestra un aviso y se listan todos los abonos.

### 3. Navegación directa a una meta en Ahorros
Ahorros aceptará una meta en la URL: abre la pestaña correcta (Metas o Retos), resalta la
tarjeta y hace scroll hasta ella. Si la meta ya no existe, aviso sin navegación fallida.

### 4. Acciones rápidas en la campana de notificaciones
Cada notificación muestra un botón contextual según su tipo:

| Tipo | Botón | Destino |
| --- | --- | --- |
| nueva_deuda | Ver deuda | Deudas, con la deuda resaltada |
| por_vencer / en_mora / riesgo_mora | Registrar abono | Deudas, con la deuda resaltada |
| pago_total_pendiente | Subir comprobante | Deudas, con la deuda resaltada |
| abono_registrado | Ver abonos | Abonos, filtrado por esa deuda |
| meta_completada | Ver meta | Ahorros, con la meta resaltada |

Al tocar el botón: la notificación se marca como leída individualmente, el panel se cierra y
se navega al destino. Si la notificación no tiene un registro asociado, solo se marca como
leída y se muestra un aviso, sin navegar. Se conservan "Marcar leídas", el contador de no
leídas y la llegada de notificaciones en tiempo real.

## Detalles técnicos

- `NotificationBell.tsx`: incluir `related_id` en el tipo `Notif` (la consulta ya usa `*`),
  volver controlado el `Popover` con estado `open`, agregar `useNavigate`, un mapa
  `notif_type -> { label, ruta, parámetro }` y `marcarUna(id)` que actualiza
  `notifications.read` por `id` y refleja el cambio en el estado local.
- Rutas de destino: `/deudas` y `/abonos` con `search: { debtId }`; `/ahorros` con
  `search: { goalId }`.
- `ahorros.tsx`: agregar `validateSearch` con `goalId` opcional, `Route.useSearch()`, pasar
  `Tabs` a modo controlado (`value` + `onValueChange`) para poder seleccionar Metas o Retos
  según la meta buscada, envolver cada `GoalCard` con `id={"goal-" + g.id}` y aplicar anillo
  de resaltado, más un `useEffect` que haga scroll y avise con `toast.info` si no existe.
- `abonos.tsx`: `useEffect` que, al cargar las deudas, aplique `setDebt(debtId)` si existe o
  muestre `toast.info` si no.
- `panel.tsx:204` y `calendario.tsx:173`: añadir `search={{ debtId: debt.id }}` al `Link`.
- Verificación final: typecheck sin errores y build en verde.
