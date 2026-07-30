## Multi-familia (multi-tenant) para HogarFin

Hoy toda la data es global: un solo espacio compartido. Vamos a aislar cada familia para que muchos hogares usen la app sin verse entre sí.

### Modelo

- Nueva tabla `families` (id, name, created_by, created_at).
- Nueva tabla `family_members` (family_id, user_id, role: admin | miembro | invitado, joined_at) — reemplaza a `user_roles`.
- Todas las tablas del dominio ganan `family_id NOT NULL`:
  `debts`, `debt_members`, `payments`, `savings_goals`, `savings_contributions`, `expenses`, `notifications`, `activity_log`, `invitations`.
- Función `is_family_member(uid, fid)` y `family_role(uid, fid)` SECURITY DEFINER para RLS sin recursión.

### Alta y pertenencia

- Al registrarse un usuario:
  - Trigger crea `profile` (ya existe) **y** crea una **familia propia** con `name = "Familia de {nombre}"` + `family_members(role=admin)`.
  - Se elimina la lógica "primer usuario = admin global".
- Un usuario puede pertenecer a varias familias en el futuro, pero por ahora la UI trabaja con **una familia activa** (la primera de la que sea miembro; si es admin de la suya, esa).

### Invitaciones

- `invitations` gana `family_id`. El admin genera link **para su familia**.
- `redeem_invitation(token)` inserta al usuario en `family_members` de esa familia con el rol de la invitación (invitado por defecto). Ya no toca `user_roles`.
- Un usuario que acepta una invitación queda además como miembro de esa otra familia (podrá cambiar entre familias más adelante; en esta entrega mostramos la propia por defecto o la última aceptada).

### RLS (resumen no técnico)

- Ver/registrar deudas, abonos, ahorros, gastos, notificaciones e historial: solo si eres miembro de la familia dueña del registro.
- Editar/eliminar deudas y gestionar miembros/invitaciones: solo admin de esa familia.
- Invitados: solo lectura dentro de su familia.

### Frontend

- `useAuth` expone `currentFamilyId` y `role` (dentro de esa familia).
- Selector de familia en el header cuando el usuario pertenece a más de una.
- Todos los queries filtran por `family_id = currentFamilyId` y los `insert` lo incluyen (server-side también lo enforza vía RLS + default).
- Nueva página **Mi familia** (admin) para renombrar la familia.
- `Miembros` sigue existiendo pero lista solo miembros de la familia activa; el admin puede cambiar roles **dentro de su familia**.

### Migración de datos existentes

Solo hay 2 usuarios de prueba. Para no complicar:
- Se crea una familia "Familia demo" con los datos actuales asignados a ella.
- `stiven.arroyave05@gmail.com` queda como admin de esa familia; `facturafacilpyme@gmail.com` como miembro.
- A partir de ahí, cada nuevo registro crea su propia familia.

### Alcance de esta entrega

1. Migración SQL: `families`, `family_members`, `family_id` en todas las tablas, RLS nueva, trigger de creación de familia al registrar, `redeem_invitation` v2, backfill de datos existentes, drop de `user_roles` y `has_role`.
2. `useAuth` con `currentFamilyId`.
3. Ajuste de todas las páginas (`panel`, `deudas`, `ahorros`, `caja-menor`, `calendario`, `reportes`, `historial`, `miembros`, invitaciones, `NotificationBell`) para filtrar/insertar por familia.
4. Página **Mi familia** mínima (renombrar).

¿Apruebo y arranco así, o quieres ajustar algo (p. ej. permitir varias familias por usuario ya desde ahora con selector visible siempre, o dejar que el usuario elija el nombre de su familia al registrarse)?