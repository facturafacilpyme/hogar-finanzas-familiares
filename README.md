# Hogar Finanzas Familiares

Crea una aplicación web completa llamada "HogarFin" - Organizador Familiar de Finanzas. 

Usa: React + Vite + Supabase + Tailwind + shadcn/ui. Mobile-first y en Español.

OBJETIVO: Que una familia pueda controlar deudas, asignar pagos, fomentar ahorro y recibir notificaciones gratis.

### 1. ROLES Y AUTENTICACIÓN

- Admin: Puede crear/editar/eliminar deudas, asignar porcentajes, ver reportes de todos, gestionar miembros.

- Miembro: Ver solo sus deudas, registrar abonos, ver metas de ahorro, ver calendario.

- Invitado: Solo lectura de todo.

- Usar Supabase Auth con Email + Contraseña.

### 2. BASE DE DATOS SUPABASE

Tablas:

users: id, email, name, role, avatar

debts: id, name, entity, total_amount, debt_type: 'unico'|'cuotas', total_cuotas, current_cuota, due_date, created_date, status: 'activa'|'pagada'|'mora', notes, created_by

debt_members: id, debt_id, user_id, percentage, amount_per_cuota

payments: id, debt_id, user_id, amount, payment_date, proof_url, notes

savings_goals: id, name, target_amount, current_amount, due_date, created_by

savings_contributions: id, goal_id, user_id, amount, contribution_date

notifications: id, user_id, type, message, read, created_at

expenses: id, category, amount, expense_date, description, paid_by // Para "Caja Menor"

### 3. MÓDULOS FUNCIONALES

A. MÓDULO DEUDAS

- Formulario crear deuda: Nombre, Entidad, Valor Total, Tipo: Pago Único o A Cuotas. Si es cuotas: # de cuotas y valor por cuota. Fecha generación y Fecha de vencimiento mensual.

- Asignar responsables: Seleccionar miembros y asignar % a cada uno. La app calcula automático: valor_total * % = lo que le toca a cada uno.

- Registrar abono: Quién paga, cuánto, fecha, subir foto de comprobante. Restar al saldo y marcar cuotas pagadas.

- Estados: Al día, Por vencer en 3 días, En mora, Pagada.

- Filtros por entidad, por persona, por estado.

B. MÓDULO CALENDARIO

- Vista mensual con todas las fechas de pago.

- Alertas: Marcar en amarillo si faltan 3 días, en rojo si está en mora.

C. MÓDULO AHORRO FAMILIAR

- Crear metas: Nombre, Meta $, Fecha objetivo.

- Aportes voluntarios: Cualquier miembro puede aportar cuando quiera.

- Barra de progreso % y monto faltante.

- Retos semanales: "Ahorrar $50.000 entre todos esta semana"

D. MÓDULO CAJA MENOR

- Registrar gastos diarios del hogar: mercado, servicios, etc.

- Categorías: Mercado, Transporte, Salud, Otros.

- No afecta las deudas.

E. MÓDULO REPORTES Y DASHBOARD

- Admin: Deuda total familiar, Total ahorrado, Próximos 3 pagos, Gráfica de deuda por entidad.

- Por Persona: Cuánto debe, cuánto ha abonado, % de avance.

- Exportar a Excel y PDF.

F. HISTORIAL

- Log de todas las acciones: quién creó deuda, quién abonó, cuándo. Nada se borra.

### 4. SISTEMA DE NOTIFICACIONES 100% GRATIS

Enviar notificación cuando:

1. Se crea una nueva deuda

2. Faltan 3 días para una fecha de pago

3. Se registra un abono

4. Una deuda entra en mora

5. Se completa una meta de ahorro

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/813cb785-e00e-4a30-8f7a-2220bebe4302).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
