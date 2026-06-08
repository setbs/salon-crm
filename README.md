# Beauty Salon CRM

A modern CRM system for beauty salons with online appointment booking, employee management, cosmetics inventory tracking, product sales management, and customer relationship management.

---

## Features

### Client Features

* Online appointment booking
* Guest booking without registration
* User registration and authentication
* Appointment history
* Reviews and ratings
* Portfolio browsing
* Service catalog

### Employee Features

* Personal schedule management
* Appointment details
* Appointment notes
* Portfolio photo uploads
* Product sales registration

### Administrator Features

* Client management
* Employee management
* Appointment management
* Calendar management
* Service management
* Portfolio management
* Review management
* Payment management
* Inventory management
* Product sales management
* Salon settings management

---

## Inventory Management

The CRM includes a built-in inventory module for beauty products.

Features:

* Product catalog
* Product categories
* Stock tracking
* Low stock notifications
* Product sales history
* Stock movement history

---

## Technology Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Vite

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* PostgreSQL
* Prisma ORM

### Authentication

* JWT Access Tokens
* Refresh Tokens

### Deployment

* Docker
* Azure

---

## User Roles

### Guest

* Browse services
* Browse portfolio
* View available appointment slots
* Create appointments without registration

### Client

* Register
* Login
* Create appointments
* Cancel appointments
* View appointment history
* Leave reviews

### Employee

* Manage personal schedule
* View appointment details
* Add appointment notes
* Upload portfolio photos
* Register product sales

### Admin

* Full system access

---

## Project Structure

```text
crm-salon/
│
├── docs/
│   ├── ERD.md
│   ├── USE_CASES.md
│   ├── ACTIVITY_DIAGRAMS.md
│   └── API_SPEC.md
│
├── backend/
│
├── frontend/
│
├── docker/
│
├── PROJECT_CONTEXT.md
│
└── README.md
```

---

## Database Modules

### Core CRM

* Users
* Employees
* Services
* Appointments
* Reviews
* Payments
* Portfolio

### Scheduling

* Working Hours
* Business Hours
* Employee Time Off

### Authentication

* Refresh Tokens
* Notification Logs

### Inventory

* Product Categories
* Products
* Product Sales
* Product Sale Items
* Stock Movements

### Configuration

* Salon Settings

---

## Development Status

### Completed

* Requirements analysis
* Database design (ERD)
* Use Case Diagrams
* Activity Diagrams
* Initial API Design

### In Progress

* Backend architecture
* API implementation

### Planned

* Frontend implementation
* Docker deployment
* Azure deployment
* Production testing

---

## Future Improvements

* SMS notifications
* Email reminders
* Online payments
* Loyalty system
* Gift cards
* Multi-salon support
* Mobile application

---

## License

Private project.
