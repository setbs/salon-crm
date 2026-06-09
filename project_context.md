# Beauty Salon CRM - Project Context

This document is the handoff context for future agents. Read it before changing the project.

## Current State

Beauty Salon CRM is a TypeScript web app for a beauty salon. The first working vertical slice is guest appointment booking:

1. Guest selects one or more services.
2. Guest selects an employee who provides those services.
3. Guest selects a date and available time slot.
4. Guest enters contact details.
5. Backend creates a client user and appointment in PostgreSQL.

The project is now a working monorepo skeleton, not only documentation. Backend, frontend, Docker Compose, Prisma schema, migration SQL, and seed data exist. The admin dashboard is connected to backend endpoints backed by PostgreSQL seed data, including first write-side admin actions.

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
* `service_categories`
* `services`
* `employee_services`
* `appointments`
* `appointment_services`
* `working_hours`
* `employee_time_off`
* `payments`
* `portfolio_photos`
* `reviews`
* `salon_settings`
* `business_hours`
* `product_categories`
* `products`
* `product_sales`
* `product_sale_items`
* `stock_movements`
* `notification_logs`
* `report_export_logs`

Current enums:

* `UserRole`: `CLIENT`, `EMPLOYEE`, `ADMIN`
* `AppointmentStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`
* `PaymentMethod`: `CASH`, `CARD`, `BLIK`, `TRANSFER`
* `PaymentStatus`: `PENDING`, `PAID`, `REFUNDED`
* `StockMovementType`: `PURCHASE`, `SALE`, `ADJUSTMENT`, `RETURN`

Seed file:

* `backend/prisma/seed.ts`

Seed creates:

* service categories: `Стрижки`, `Манікюр`, `Фарбування`, `Трихологія`
* services: `Жіноча стрижка`, `Класичний манікюр`, `Фарбування волосся`
* employees: Anna Kowalska, Maya Nowak
* employee-service mappings
* working hours Monday-Saturday, `09:00`-`18:00`

Migration SQL:

* `backend/prisma/migrations/20260608143800_init/migration.sql`
* `backend/prisma/migrations/20260608161500_admin_foundation/migration.sql`
* `backend/prisma/migrations/20260608170000_admin_write_actions/migration.sql`
* `backend/prisma/migrations/20260608173000_service_categories/migration.sql`

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
* `GET /api/admin/dashboard`
* `GET /api/admin/appointments`
* `GET /api/admin/clients`
* `GET /api/admin/service-categories`
* `GET /api/admin/services`
* `GET /api/admin/employees`
* `GET /api/admin/portfolio`
* `GET /api/admin/products`
* `GET /api/admin/sales`
* `GET /api/admin/payments`
* `GET /api/admin/reviews`
* `GET /api/admin/settings`
* `PATCH /api/admin/appointments/:id`
* `POST /api/admin/service-categories`
* `PATCH /api/admin/service-categories/:id`
* `POST /api/admin/services`
* `PATCH /api/admin/services/:id`
* `POST /api/admin/products`
* `PATCH /api/admin/products/:id`
* `POST /api/admin/sales`
* `PATCH /api/admin/payments/:id`
* `PATCH /api/admin/settings`

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

Admin module:

* `backend/src/modules/admin/admin.routes.ts`
* `backend/src/modules/admin/admin.service.ts`
* `backend/src/modules/admin/admin.repository.ts`

Admin behavior:

* Provides API foundation for the admin dashboard.
* Reads appointments, clients, services, employees, portfolio, products, sales, payments, reviews, and settings from PostgreSQL.
* Computes dashboard cards from operational tables.
* Supports first write-side actions: appointment status/comment/time update, service create/update, product create/update, product sale creation with stock decrement, payment status update, settings update.
* Does not yet implement admin authentication or full CRUD for every admin section.

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
* All new site and admin UI copy should be Ukrainian by default.
* Currency display: UAH via `Intl.NumberFormat("uk-UA", { currency: "UAH" })`
* Visual style: business document / salon price-list
* Layout: two columns on desktop, single flow on mobile
* Left column: monogram, contact block, price-list service selection
* Right column: booking form, available slots, client details, summary
* Admin CRM is the default frontend mode.
* Admin CRM fetches data from `/api/admin/*`; it no longer uses hardcoded mock arrays for tables.
* Admin CRM forms are wired for services, products, sales, payment status updates, appointment status updates, and salon settings.
* Services are grouped by admin-managed service categories.
* Admin can create service categories, enable/disable them, and assign new services to a category.
* Public booking renders the price list grouped by service category from API data.

Frontend keeps a backward-compatible display mapping for old English seed service names in `App.tsx`:

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
* Service category management
* Analytics dashboard
* Email notifications
* CSV reports
* Salon settings

Roles:

* Guest: browse services/portfolio, check slots, book without registration.
* Client: register, login, book/cancel appointments, history, reviews.
* Employee: schedule, appointment details/comments, portfolio uploads, product sales.
* Admin: full management access.

## Version 1.0 Mandatory Modules

The following modules are not future ideas. They are required for version 1.0 and must be reflected in database planning, API planning, admin dashboard planning, and implementation sequencing.

### Analytics Module

Admin dashboard must have a dedicated `Analytics` section.

Revenue analytics:

* Daily revenue
* Weekly revenue
* Monthly revenue
* Yearly revenue

Service analytics:

* Most popular services
* Service usage count
* Revenue per service
* Average order value per service

Product analytics:

* Best-selling products
* Most profitable products
* Product stock overview
* Low stock reports

Client analytics:

* Total clients
* New clients per month
* Returning clients
* Top clients by spending
* Average client spending

Employee analytics:

* Revenue generated by employee
* Total appointments
* Total clients served
* Average review rating

Architecture guidance:

* Analytics should be implemented as read-only query services over operational tables first.
* Avoid storing aggregates in v1 unless performance requires it.
* Design filters around date range, employee, service, and product category.
* Employee metrics must be ready for multi-employee support, but multi-salon is not v1.

### Notifications Module

Email notifications are required for v1.

Required appointment reminders:

* 24 hours before appointment
* 2 hours before appointment

Required post-appointment notifications:

* Thank you message
* Review request

Architecture guidance:

* All notification attempts must be logged in `notification_logs`.
* Notification logs should support appointment-related notifications.
* Build the module around a channel abstraction so future SMS can be added later.
* SMS must not be implemented in v1.
* Use background scheduling/worker architecture for reminders; do not rely on request-time side effects only.

### Reports Module

Admin dashboard must have a dedicated `Reports` section.

Required CSV exports:

* Clients export
* Appointments export
* Product sales export
* Products export
* Revenue reports export

Architecture guidance:

* Reports should use dedicated export services.
* CSV generation should be server-side.
* Exports should support date range filters where relevant.
* Consider logging export requests for auditability.

## Admin Dashboard Structure

The v1 admin dashboard navigation must contain:

* Dashboard
* Calendar
* Clients
* Services
* Employees
* Portfolio
* Inventory
* Sales
* Payments
* Reviews
* Analytics
* Reports
* Settings

Dashboard should show operational summaries. Analytics should show metrics and charts. Reports should focus on CSV export workflows.

## Version 1.0 API Planning

Do not implement these endpoints yet unless explicitly requested. They are planning targets.

Analytics endpoints:

* `GET /api/admin/analytics/revenue?period=daily|weekly|monthly|yearly&from=&to=`
* `GET /api/admin/analytics/services?from=&to=`
* `GET /api/admin/analytics/products?from=&to=`
* `GET /api/admin/analytics/clients?from=&to=`
* `GET /api/admin/analytics/employees?from=&to=`

Notifications endpoints:

* `GET /api/admin/notifications/logs?status=&type=&from=&to=`
* `POST /api/admin/notifications/appointments/:appointmentId/reminder`
* `POST /api/admin/notifications/appointments/:appointmentId/thank-you`
* `POST /api/admin/notifications/appointments/:appointmentId/review-request`

Reports endpoints:

* `GET /api/admin/reports/clients.csv`
* `GET /api/admin/reports/appointments.csv?from=&to=`
* `GET /api/admin/reports/product-sales.csv?from=&to=`
* `GET /api/admin/reports/products.csv`
* `GET /api/admin/reports/revenue.csv?from=&to=&period=`

All admin endpoints must require authentication and admin authorization once auth exists.

## Version 1.0 Database Planning

Current implemented Prisma schema is still smaller than the full v1 plan. Future database work must include the original ERD plus these v1 requirements:

Analytics:

* Can be computed from `appointments`, `appointment_services`, `services`, `payments`, `product_sales`, `product_sale_items`, `products`, `reviews`, and `users`.
* No dedicated analytics table is required for v1 planning.
* If performance becomes a problem later, add materialized views or aggregate snapshot tables.

Notifications:

* Extend `notification_logs` to support email-first v1:
  * `appointment_id` nullable relation to appointments
  * `channel` such as `email`
  * `notification_type`
  * `recipient`
  * `subject`
  * `message`
  * `status`
  * `scheduled_for`
  * `sent_at`
  * `error_message`
  * timestamps

Reports:

* CSV exports can be generated directly from operational tables.
* Consider `report_export_logs` for audit:
  * `id`
  * `admin_user_id`
  * `report_type`
  * `filters`
  * `file_name`
  * `created_at`

## Future Modules Not In Version 1.0

The following are future modules only. Do not implement them in v1:

* SMS notifications
* Mobile application
* Loyalty program
* Gift cards
* Multi-salon support

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
* Complete write-side admin CRUD endpoints for clients, employees, portfolio, reviews, full appointment creation/reschedule forms, and inventory adjustments.
* Add admin analytics query endpoints.
* Add email notification scheduler and notification log workflows.
* Add CSV report export endpoints.
* Add cancellation/reschedule endpoints.
* Add tests for booking conflict behavior and slot generation.
* Normalize time zone handling before production.

Database:

* Add refresh tokens and full authentication persistence.
* Decide whether `working_hours.start_time/end_time` should stay as `String` or move to PostgreSQL `time` with a custom handling strategy.
* Resolve Prisma migration engine issue instead of relying on manual SQL for future work.

Frontend:

* Add admin Analytics and Reports sections when those APIs exist.
* Add admin notification log visibility.
* Add employee/client views.
* Add loading states per section instead of one global loading flag.
* Replace hardcoded contact details with salon settings when that module exists.
* Add form-level success details and better API error localization.

Public website:

* Add main public menu sections:
  * `Про салон`: landing/about page with salon info, portfolio, contact data, and brand presentation.
  * `Послуги`: booking flow and categorized service price list.
  * `Товари`: public product catalog grouped by product categories with prices.
  * `Відгуки`: public reviews section; still in design/development.

Inventory and service consumption:

* Add optional product consumption rules to services.
* Admin should be able to choose a product/material and quantity consumed by a service.
* Example: a men's haircut may consume no assortment product; a peeling service may consume 60g of a selected product.
* After appointment completion, consumed product quantity should be deducted from inventory.
* Add an admin-only product category/type for `витратний матеріал`.
* Consumable materials should not be sold publicly, but their usage/loss must be tracked in stock movements.

## Current Verification Status

The following checks passed after the latest frontend restyle:

```bash
npm run typecheck
npm run build
```

The service category code also passed:

```bash
npm run typecheck
npm run build
```

Operational caveat:

* `backend/prisma/migrations/20260608173000_service_categories/migration.sql` has been added but may still need to be applied to the local Docker PostgreSQL database if the agent could not access Docker.
* After applying that migration, run `npm run prisma:seed` so seed services are renamed to Ukrainian and assigned to service categories.
* Prisma Client generation was attempted, but the local generated client did not refresh in this environment. New service category reads/writes are therefore implemented with typed raw SQL while keeping the Prisma schema and migration as the source of truth.

The dev server was running and Vite HMR applied updates:

* frontend on `http://localhost:5173`
* backend on `http://localhost:4000`

API health and services were previously checked successfully:

* `GET /api/health` returned `{"status":"ok"}`
* `GET /api/services` returned seeded services
