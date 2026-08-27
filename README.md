# Salon CRM

CRM and public booking application for a beauty salon.

## About

Salon CRM is a web application for managing salon appointments, clients, services, employees, products, payments, and a public online booking flow.

The project is built as a diploma and portfolio application with a practical business workflow in mind: clients can book appointments online, while salon staff can manage schedules, services, inventory, and CRM data from an admin panel.

## Features

### Public website

- Salon home page with about, CRM-managed portfolio, contacts, and a public price list.
- Price list grouped by service categories.
- Optional service price ranges, for example `500 - 800 ₴`.
- Online booking wizard:
  - service selection;
  - employee selection, skipped automatically when only one employee fits;
  - date and time selection;
  - contact details step.
- Booking flow includes clear empty states, client-friendly error messages, nearest-slot suggestions, and a confirmation screen.
- Public availability respects employee working hours, existing appointments, and time off.

### CRM panel

- JWT authentication.
- Role-based access for admins and employees.
- Admin dashboard with financial analytics, charts, period filters, period comparison, and attention alerts.
- Appointment management.
- Client database with search and client profiles.
- Employee profiles with service assignment and activation control.
- Employee weekly schedules and time-off blocks.
- Portfolio management for public website gallery, with image URL or local file upload.
- Service and service category management.
- Product inventory and product sales.
- Product categories, brands, product photos, public product detail modals, and internal product purpose control.
- Product editing and manual stock movements.
- Store order management with search, status workflow, idempotent stock deduction on confirmation, and stock restoration on cancellation.
- Storefront payments through Monobank hosted checkout with webhook-based payment confirmation.
- Appointment completion workflow with consumable write-off preview.
- Consumable analytics with week, month, and custom period views.
- CSV export for business analytics, appointments, inventory, and consumables.
- Payments and reviews overview.
- Salon settings.

### Services and inventory

- Service categories can be created, edited, disabled, and deleted.
- Services can be created, edited, disabled, and deleted when not used in appointment history.
- Services support:
  - base price for calculations;
  - optional public display range: `price from` / `price to`;
  - duration;
  - assigned employees;
  - internal consumable cosmetics.
- Products support package content amount, for example `60 ml`.
- Stock can be adjusted either by whole packages or by actual content amount in ml/g.
- Services can define consumable products and usage amount, for example `20 ml` of a peeling product.
- Completing an appointment writes off configured service consumables from product stock and stores the write-off in `service_consumption_logs`.
- Before completing an appointment, CRM users can preview the exact consumables to be written off and whether stock is sufficient.
- The dashboard shows service profitability, product sales, material pressure by service, low-stock forecast, recent write-offs, employee performance placeholders, and restock suggestions.
- Consumables are internal CRM data and are not shown to public booking users.

## Technology Stack

### Frontend

- React
- Vite
- TypeScript
- CSS
- lucide-react icons
- Separate Vite entry points for the public salon site and CRM admin panel.

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT with `jose`
- Zod validation

### Database and infrastructure

- PostgreSQL
- Docker Compose for local PostgreSQL
- Prisma migrations and seed data

## Project Structure

```text
backend/   Express API, Prisma schema, migrations, seed data
frontend/  React + Vite client application
docs/      ERD, use-case, activity diagrams, planning notes
docker/    Local PostgreSQL compose configuration
```

## Getting Started

### Requirements

- Node.js 20+
- npm
- Docker

### Installation

```bash
git clone https://github.com/setbs/salon-crm.git
cd salon-crm
npm install
```

Create local environment variables:

```bash
cp .env.example .env
```

Start PostgreSQL:

```bash
npm run db:up
```

Apply database migrations:

```bash
cd backend
npx prisma migrate deploy
cd ..
```

Seed demo data:

```bash
npm run prisma:seed
```

Start the application:

```bash
npm run dev
```

Local URLs:

```text
Frontend: http://localhost:5173
CRM dev page: http://localhost:5173/crm.html
Backend:  http://localhost:4000
Health:   http://localhost:4000/api/health
```

The public salon website and CRM are split at the frontend entry-point level:

```bash
cd frontend
npm run build:salon # outputs frontend/dist-salon
npm run build:crm   # outputs frontend/dist-crm
```

Recommended deployment:

```text
salon.example.com      -> frontend/dist-salon
crm.salon.example.com  -> frontend/dist-crm
api.salon.example.com  -> backend
```

For a combined local production build, `npm run build --workspace frontend` still produces `frontend/dist` with both `index.html` and `crm.html`.

To allow the independent `product-store` frontend to call the API, configure its origin in `salon-crm/.env`:

```text
FRONTEND_ORIGIN=http://localhost:5173
STOREFRONT_ORIGIN=http://localhost:5174
FRONTEND_URL=http://localhost:5174
BACKEND_PUBLIC_URL=https://your-public-backend-url.example
MONOBANK_TOKEN=your_monobank_merchant_or_test_token
```

For production, put both public salon and CRM origins into `FRONTEND_ORIGIN`, separated by commas, for example `https://salon.example.com,https://crm.salon.example.com`.

`FRONTEND_URL` is used by Monobank as the redirect target after checkout. `BACKEND_PUBLIC_URL` must be a public HTTPS URL for Monobank webhooks; in local development use a tunnel if you need real webhook confirmation.
If `BACKEND_PUBLIC_URL` is empty or not HTTPS, the backend will create Monobank invoices without `webHookUrl`. This is useful for local testing because Monobank cannot call `http://localhost`.

For Railway, configure payment secrets through Railway Variables, not repository files:

```text
Backend service:
MONOBANK_TOKEN=<your token>
BACKEND_PUBLIC_URL=https://your-backend.up.railway.app
FRONTEND_URL=https://your-product-store.up.railway.app
STOREFRONT_ORIGIN=https://your-product-store.up.railway.app
FRONTEND_ORIGIN=https://your-salon-frontend.up.railway.app,https://your-crm-frontend.up.railway.app

Product-store service:
VITE_API_URL=https://your-backend.up.railway.app
```

Do not commit a real Monobank token. If the token is exposed, rotate it in Monobank and update Railway Variables.

Public read-only product endpoints are available without CRM authentication:

```text
GET /api/public/products
GET /api/public/products/:id
GET /api/public/popular-products
GET /api/public/store-reviews
POST /api/public/store-reviews
POST /api/public/orders
GET /api/public/orders/:id/payment-status
POST /api/public/orders/:id/pay
POST /api/payments/monobank/webhook
```

## Demo Credentials

Admin:

```text
Email:    admin@sl-color.local
Password: admin12345
```

Employees:

```text
Email:    anna@soulbeauty.local
Password: employee12345

Email:    maya@soulbeauty.local
Password: employee12345
```

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run db:up
npm run db:down
npm run prisma:generate
npm run prisma:seed
npm test
```

Run backend API tests against a real PostgreSQL test database:

```bash
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/salon_crm_test" npm run test --workspace backend
```

## Demo Data

`npm run prisma:seed` creates a practical demo setup:

- admin and employee accounts;
- service categories and services with optional public price ranges;
- employees with working hours;
- clients and appointments, including completed appointments for analytics;
- professional cosmetics categories, product brand, products with package volume, stock, and stock movements;
- service consumable definitions and completed write-off logs;
- product sale, payments, portfolio entries, review, business hours, and salon settings.

## Documentation

- ERD: `docs/ERD.sql`
- Use-case diagram: `docs/use-case.md`
- Client booking process diagram: `docs/activity-client.md`
- Additional planning documents: `docs/`

## Current Notes

- Docker is used locally for PostgreSQL.
- The frontend talks to the backend through Vite `/api` proxy in development.
- Public service data does not expose internal consumable cosmetics.
- Consumable stock is tracked in ml/g and shown as package-equivalent stock in the CRM inventory.
- Low-stock alerts use ml/g content stock for consumable products and package stock for regular retail products.
- Consumable write-off is idempotent: moving an already completed appointment through updates does not subtract the same materials twice.
- Build output such as `backend/dist/` and `frontend/dist/` is ignored and should not be edited manually.

## License

This project is intended for educational and portfolio purposes.
