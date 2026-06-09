# API Planning

This document defines planned API surfaces. Do not treat these endpoints as implemented until code exists.

All `/api/admin/*` endpoints require admin authentication and authorization once auth is implemented.

## Existing MVP Endpoints

Implemented guest booking endpoints:

* `GET /api/health`
* `GET /api/services`
* `GET /api/employees?serviceIds=1,2`
* `GET /api/availability?employeeId=1&serviceIds=1,2&date=YYYY-MM-DD`
* `POST /api/appointments`

## Analytics Endpoints

Revenue:

* `GET /api/admin/analytics/revenue?period=daily|weekly|monthly|yearly&from=&to=`

Services:

* `GET /api/admin/analytics/services?from=&to=`

Products:

* `GET /api/admin/analytics/products?from=&to=`

Clients:

* `GET /api/admin/analytics/clients?from=&to=`

Employees:

* `GET /api/admin/analytics/employees?from=&to=`

Expected response style:

* Return JSON.
* Include requested date range.
* Include metric totals and grouped rows.
* Use numeric money values in the API; frontend formats currency.

## Notifications Endpoints

Logs:

* `GET /api/admin/notifications/logs?status=&type=&channel=&from=&to=`

Manual appointment notification triggers:

* `POST /api/admin/notifications/appointments/:appointmentId/reminder`
* `POST /api/admin/notifications/appointments/:appointmentId/thank-you`
* `POST /api/admin/notifications/appointments/:appointmentId/review-request`

Background scheduling:

* Worker should schedule and send 24-hour and 2-hour reminders.
* Worker should send thank you and review request after appointment completion.
* Every attempt must create or update `notification_logs`.

## Reports Endpoints

CSV exports:

* `GET /api/admin/reports/clients.csv`
* `GET /api/admin/reports/appointments.csv?from=&to=`
* `GET /api/admin/reports/product-sales.csv?from=&to=`
* `GET /api/admin/reports/products.csv`
* `GET /api/admin/reports/revenue.csv?from=&to=&period=daily|weekly|monthly|yearly`

Expected response style:

* Return `text/csv`.
* Include `Content-Disposition` with a useful filename.
* Apply admin authorization.
* Log export requests if `report_export_logs` is implemented.

