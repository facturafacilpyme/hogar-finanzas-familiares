# HogarFin — pendientes

Estado al 2026-10-04. Completado recientemente: reparto de deuda por ingresos, estrategia de
desendeudamiento en Reportes, OCR en abonos y comprobante de pago total, categorías de gasto
personalizables por familia, historial mes a mes en Deudas, paginación incremental (`Pager`) en
deudas/abonos/aportes/metas, menú simplificado del rol educativo, nombres reales de categoría en
Reportes.

## 1. Gamificación de Ahorros (resto de UI)

La base ya existe: retos colectivos con cierre automático (`close_expired_challenges` + pg_cron),
insignias por trigger (`award_badges`) y Fondo de Reserva (`use_reserve_for_debt`). Falta pulir
`src/routes/_authenticated/ahorros.tsx`:

- Ranking de aportantes por reto (quién va primero en cada reto semanal).
- Barras de progreso animadas en metas y retos.
- Presentación de insignias por miembro (vitrina en la meta o en el perfil).

## 2. Paginación del lado del servidor

`Pager` hoy solo limita el renderizado: el cliente sigue descargando todas las filas de golpe
(Historial con `limit(500)`). Cuando el volumen crezca, pasar a paginación real con `range()` de
Supabase o cursores en Deudas, Abonos e Historial.

## 3. Verificación visual pendiente

- Probar con una cuenta real del rol educativo que el menú simplificado y las redirecciones
  funcionan.
- Probar Reportes con categorías personalizadas (gráficas y exportaciones).
