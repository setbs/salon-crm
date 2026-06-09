# Salon CRM

CRM system for managing a beauty salon.

## About the Project

Salon CRM is a web application designed to help beauty salons manage appointments, clients, services, employees, and sales in a single place.

The project was created as a learning and portfolio application focused on modern web technologies and practical business workflows used in small service-based companies.

## Features

### Appointment Management

* Create and edit appointments
* Calendar view
* Employee scheduling
* Appointment status tracking

### Client Management

* Client database
* Contact information
* Appointment history
* Notes and comments

### Services

* Service categories
* Service pricing
* Service duration management
* Active/inactive services

### Products

* Product catalog
* Product pricing
* Inventory tracking (planned)

### Administration

* User authentication
* Role-based access
* Administrative dashboard
* Business statistics

## Technology Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Node.js
* Next.js API Routes
* Prisma ORM

### Database

* PostgreSQL

## Getting Started

### Requirements

* Node.js 20+
* PostgreSQL
* npm

### Installation

```bash
git clone https://github.com/setbs/salon-crm.git
cd salon-crm

npm install
```

Create an `.env` file and configure the database connection.

Run database migrations:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

Application will be available at:

```text
http://localhost:3000
```

## Current Status

The project is under active development.

Implemented:

* Authentication
* Appointment management
* Client management
* Services and categories
* Administrative panel

Planned:

* Product inventory
* Reviews module
* Service material consumption tracking
* Advanced reporting

## License

This project is intended for educational and portfolio purposes.
