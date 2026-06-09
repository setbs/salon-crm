# Admin Dashboard Planning

This document defines the required version 1.0 admin dashboard structure.

## Navigation

The admin dashboard must contain these sections:

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

## Section Responsibilities

Dashboard:

* Operational summary.
* Today appointments.
* Revenue snapshot.
* Low stock warnings.
* Pending reviews or notifications.

Calendar:

* Day, week, and month appointment views.
* Create, edit, cancel appointments.
* Show free and booked slots.

Clients:

* Client list.
* Client profile.
* Appointment and spending history.

Services:

* Manage service catalog.
* Manage service categories.
* Assign services to categories.
* Manage duration, price, active status.

Employees:

* Employee profiles.
* Services provided by employee.
* Working hours and future time-off planning.

Portfolio:

* Manage employee portfolio photos.

Inventory:

* Product categories.
* Products.
* Future admin-only consumable material category/type.
* Stock overview.
* Low stock reports.
* Stock movement history.

Sales:

* Product sales list.
* Register product sale.
* Link sale to client when available.

Payments:

* Appointment payment records.
* Payment status overview.

Reviews:

* Review list.
* Rating overview.
* Moderation workflow if needed.

Analytics:

* Revenue analytics.
* Service analytics.
* Product analytics.
* Client analytics.
* Employee analytics.

Reports:

* CSV exports for clients, appointments, product sales, products, and revenue.
* Export filters and audit visibility.

Settings:

* Salon profile.
* Business hours.
* Notification settings.
* Future integration settings.

## Language Rule

The public website and admin dashboard should use Ukrainian UI copy by default.

## Later, Not Current Implementation

Public website sections to add later:

* `Про салон`: salon information, portfolio, contacts, brand presentation.
* `Послуги`: categorized services and booking.
* `Товари`: public product catalog by categories with prices.
* `Відгуки`: public reviews section.

Inventory/service consumption to add later:

* Optional product/material consumption per service.
* Admin selects product/material and quantity when creating or editing a service.
* Appointment completion deducts consumed product/material quantity from inventory.
* Consumable materials are admin-only inventory items, not public sale products.

## Design Guidance

The admin dashboard is an operational CRM interface, not a marketing landing page.

Use:

* Dense but readable tables.
* Filters for date range, status, employee, service, and product category.
* Compact metric cards only where they improve scanning.
* Clear empty, loading, and error states.
