# Beauty Salon CRM - Project Context

This document is the handoff context for future agents. Read it before changing the project.

## Current State

Beauty Salon CRM is a TypeScript web app for a beauty salon. The first working vertical slice is guest appointment booking:

1. Guest selects one or more services.
2. Guest selects an employee who provides those services.
3. Guest selects a date and available time slot.
4. Guest enters contact details.
5. Backend creates a client user and appointment in PostgreSQL.

The project is now a working monorepo skeleton, not only documentation. Backend, frontend, Docker Compose, Prisma schema, migration SQL, and seed data exist.

## Tech Stack

Frontend:

* React 18
* TypeScript
* Vite
* Plain CSS
* lucide-react icons

Backend:

* Node.js
* Express
* TypeScript
* Zod validation
* Prisma Client

Database:

* PostgreSQL 16 in Docker
* Prisma schema as the application data model

Root tooling:

* npm workspaces: `backend`, `frontend`
* Root scripts orchestrate backend/frontend/database tasks

## Important Commands

Run commands from the repository root:

```bash
cd /home/ew/Workspace/salon-crm
npm install
npm run db:up
npm run prisma:generate
npm run prisma:seed
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
npm run db:down
```

Local URLs:

* Frontend: `http://localhost:5173`
* Backend API: `http://localhost:4000`
* PostgreSQL from host: `localhost:5433`
* PostgreSQL inside container: `5432`

## Environment

Root `.env` currently uses:

```env
POSTGRES_USER=salon
POSTGRES_PASSWORD=salon
POSTGRES_DB=salon_crm
POSTGRES_PORT=5433
DATABASE_URL=postgresql://salon:salon@localhost:5433/salon_crm?schema=public
```

Backend `.env` uses the same database URL plus:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

Port `5433` is intentional. Port `5432` was already occupied on the host, so this project publishes PostgreSQL on `5433`.

The root `db:up` script must keep `--env-file .env`, because the compose file lives under `docker/` and otherwise Docker Compose may not pick up the root env file correctly.

## Database And Prisma Notes

Main schema:

* `backend/prisma/schema.prisma`

Current implemented tables:

* `users`
* `employees`
* `services`
* `employee_services`
* `appointments`
* `appointment_services`
* `working_hours`

Current enums:

* `UserRole`: `CLIENT`, `EMPLOYEE`, `ADMIN`
* `AppointmentStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`

Seed file:

* `backend/prisma/seed.ts`

Seed creates:

* services: Women's haircut, Classic manicure, Hair coloring
* employees: Anna Kowalska, Maya Nowak
* employee-service mappings
* working hours Monday-Saturday, `09:00`-`18:00`

Migration SQL:

* `backend/prisma/migrations/20260608143800_init/migration.sql`

Important operational note:

* `prisma migrate dev` produced an empty `Schema engine error` locally.
* The initial schema was applied manually with `docker exec ... psql -f /tmp/migration.sql`.
* `_prisma_migrations` was then created/marked manually for `20260608143800_init`.
* Do not assume Prisma migration history was produced by a normal `migrate dev` run.
* For future schema changes, first try `npm run prisma:migrate`; if the same schema-engine issue returns, generate SQL with Prisma diff and apply via `psql`, then update migration history deliberately.

## Backend Architecture

Entrypoints:

* `backend/src/server.ts` starts the HTTP server.
* `backend/src/app.ts` configures Express, CORS, JSON parsing, health route, feature routers, and centralized error handling.

Config:

* `backend/src/config/env.ts` validates env vars with Zod.
* `backend/src/config/prisma.ts` exports the Prisma Client singleton.

Shared utils:

* `backend/src/utils/http-error.ts` provides typed HTTP errors.
* `backend/src/utils/time.ts` contains date/slot helpers and ID-list parsing.

Implemented API routes:

* `GET /api/health`
* `GET /api/services`
* `GET /api/employees?serviceIds=1,2`
* `GET /api/availability?employeeId=1&serviceIds=1,2&date=YYYY-MM-DD`
* `POST /api/appointments`

Backend module pattern:

* Routes parse requests and call services.
* Services contain business logic and response shaping.
* Repositories contain Prisma queries.
* Keep business logic out of route handlers.

Catalog module:

* `backend/src/modules/catalog/catalog.routes.ts`
* `backend/src/modules/catalog/catalog.service.ts`
* `backend/src/modules/catalog/catalog.repository.ts`

Booking module:

* `backend/src/modules/booking/booking.routes.ts`
* `backend/src/modules/booking/booking.schemas.ts`
* `backend/src/modules/booking/booking.service.ts`
* `backend/src/modules/booking/booking.repository.ts`

Booking behavior:

* Validates query/body with Zod.
* Ensures selected services exist and are active.
* Ensures selected employee provides all selected services.
* Calculates total duration from selected services.
* Builds slots from employee working hours in 30-minute increments.
* Excludes slots overlapping non-cancelled appointments.
* Creates a new `CLIENT` user for guest booking.
* Creates appointment and appointment-service rows in a transaction.
* Returns `409` if the slot is no longer available.

## Frontend Architecture

Main files:

* `frontend/src/main.tsx`
* `frontend/src/api.ts`
* `frontend/src/App.tsx`
* `frontend/src/styles.css`

Frontend API wrapper:

* `fetchServices()`
* `fetchEmployees(serviceIds)`
* `fetchAvailability(employeeId, serviceIds, date)`
* `createAppointment(payload)`

Current UI style:

* Brand: `SL Color Studio`
* Language: Ukrainian
* Currency display: UAH via `Intl.NumberFormat("uk-UA", { currency: "UAH" })`
* Visual style: business document / salon price-list
* Layout: two columns on desktop, single flow on mobile
* Left column: monogram, contact block, price-list service selection
* Right column: booking form, available slots, client details, summary

Frontend intentionally maps current seed service names to Ukrainian display copy in `App.tsx`:

* `Women's haircut` -> `Жіноча стрижка`
* `Classic manicure` -> `Класичний манікюр`
* `Hair coloring` -> `Фарбування волосся`

Unknown services fall back to API-provided names/descriptions.

Do not add Tailwind for the current frontend unless explicitly requested. The live UI currently uses plain CSS.

## Product Requirements

Long-term system scope:

* Online appointment booking
* Guest booking without registration
* User accounts and authentication
* Employee management
* Appointment calendar management
* Portfolio management
* Reviews
* Payment tracking
* Cosmetics inventory management
* Product sales management
* Salon settings

Roles:

* Guest: browse services/portfolio, check slots, book without registration.
* Client: register, login, book/cancel appointments, history, reviews.
* Employee: schedule, appointment details/comments, portfolio uploads, product sales.
* Admin: full management access.

Development rules:

* Use TypeScript everywhere.
* PostgreSQL is the primary database.
* REST API.
* DTO validation with Zod.
* Service/repository pattern.
* Keep route handlers thin.
* Preserve future multi-employee and multi-salon flexibility.

## Known Gaps / Next Good Steps

Backend:

* Add authentication and role-based authorization.
* Add admin appointment/calendar endpoints.
* Add cancellation/reschedule endpoints.
* Add service/employee management endpoints.
* Add tests for booking conflict behavior and slot generation.
* Normalize time zone handling before production.

Database:

* Extend Prisma schema to cover the full original ERD: payments, portfolio, reviews, refresh tokens, notifications, business hours, time off, inventory, product sales, salon settings.
* Decide whether `working_hours.start_time/end_time` should stay as `String` or move to PostgreSQL `time` with a custom handling strategy.
* Resolve Prisma migration engine issue instead of relying on manual SQL for future work.

Frontend:

* Add admin/employee/client views.
* Add loading states per section instead of one global loading flag.
* Replace hardcoded contact details with salon settings when that module exists.
* Add form-level success details and better API error localization.

## Current Verification Status

The following checks passed after the latest frontend restyle:

```bash
npm run typecheck
npm run build
```

The dev server was running and Vite HMR applied updates:

* frontend on `http://localhost:5173`
* backend on `http://localhost:4000`

API health and services were previously checked successfully:

* `GET /api/health` returned `{"status":"ok"}`
* `GET /api/services` returned seeded services

