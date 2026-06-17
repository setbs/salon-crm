# Salon CRM

CRM and public booking application for a beauty salon.

## About

Salon CRM is a web application for managing salon appointments, clients, services, employees, products, payments, and a public online booking flow.

The project is built as a diploma and portfolio application with a practical business workflow in mind: clients can book appointments online, while salon staff can manage schedules, services, inventory, and CRM data from an admin panel.

## Features

### Public website

- Salon home page with about, portfolio, contacts, and a public price list.
- Price list grouped by service categories.
- Optional service price ranges, for example `500 - 800 ₴`.
- Online booking wizard:
  - service selection;
  - employee selection, skipped automatically when only one employee fits;
  - date and time selection;
  - contact details step.

### CRM panel

- JWT authentication.
- Role-based access for admins and employees.
- Admin dashboard.
- Appointment management.
- Client database.
- Service and service category management.
- Product inventory and product sales.
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
- Services can define consumable products and usage amount, for example `20 ml` of a peeling product.
- Consumables are internal CRM data and are not shown to public booking users.

## Technology Stack

### Frontend

- React
- Vite
- TypeScript
- CSS
- lucide-react icons

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
Backend:  http://localhost:4000
Health:   http://localhost:4000/api/health
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
npm run prisma:seed
```

## Documentation

- ERD: `docs/ERD.sql`
- Use-case diagram: `docs/use-case.md`
- Client booking process diagram: `docs/activity-client.md`
- Additional planning documents: `docs/`

## Current Notes

- Docker is used locally for PostgreSQL.
- The frontend talks to the backend through Vite `/api` proxy in development.
- Public service data does not expose internal consumable cosmetics.
- Automatic stock deduction for service consumables is prepared at the data-model level, but the final write-off logic should be implemented as a separate workflow when an appointment is completed.

## License

This project is intended for educational and portfolio purposes.
