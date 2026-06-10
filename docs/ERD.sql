Enum UserRole {
  CLIENT
  EMPLOYEE
  ADMIN
}

Enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

Enum PaymentMethod {
  CASH
  CARD
  BLIK
  TRANSFER
}

Enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
}

Enum StockMovementType {
  PURCHASE
  SALE
  ADJUSTMENT
  RETURN
}

Table users {
  id bigint [pk, increment]

  first_name varchar(100) [not null]
  last_name varchar(100) [not null]
  phone varchar(20) [not null]
  email varchar(255) [unique]
  password_hash varchar(255)
  role UserRole [not null, default: 'CLIENT']

  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table employees {
  id bigint [pk, increment]

  user_id bigint [not null, unique]
  specialization varchar(255)
  description text
  is_active boolean [not null, default: true]

  created_at timestamp [not null]
}

Table service_categories {
  id bigint [pk, increment]

  name varchar(255) [not null, unique]
  description text
  is_active boolean [not null, default: true]

  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table services {
  id bigint [pk, increment]

  category_id bigint
  name varchar(255) [not null]
  description text
  duration_minutes int [not null]
  price decimal(10,2) [not null]
  is_active boolean [not null, default: true]

  created_at timestamp [not null]
}

Table employee_services {
  employee_id bigint [not null]
  service_id bigint [not null]

  indexes {
    (employee_id, service_id) [pk]
  }
}

Table appointments {
  id bigint [pk, increment]

  client_id bigint [not null]
  employee_id bigint [not null]
  start_time timestamp [not null]
  end_time timestamp [not null]
  status AppointmentStatus [not null, default: 'PENDING']
  client_comment text
  employee_comment text

  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (employee_id, start_time, end_time)
  }
}

Table appointment_services {
  appointment_id bigint [not null]
  service_id bigint [not null]

  indexes {
    (appointment_id, service_id) [pk]
  }
}

Table working_hours {
  id bigint [pk, increment]

  employee_id bigint [not null]
  day_of_week int [not null]
  start_time varchar(5) [not null]
  end_time varchar(5) [not null]

  indexes {
    (employee_id, day_of_week) [unique]
  }
}

Table employee_time_off {
  id bigint [pk, increment]

  employee_id bigint [not null]
  start_time timestamp [not null]
  end_time timestamp [not null]
  reason text

  created_at timestamp [not null]
}

Table payments {
  id bigint [pk, increment]

  appointment_id bigint [unique]
  product_sale_id bigint [unique]
  amount decimal(10,2) [not null]
  payment_method PaymentMethod [not null]
  payment_status PaymentStatus [not null, default: 'PENDING']
  paid_at timestamp

  created_at timestamp [not null]
}

Table portfolio_photos {
  id bigint [pk, increment]

  employee_id bigint [not null]
  image_url varchar(1000) [not null]
  description text
  is_visible boolean [not null, default: true]

  created_at timestamp [not null]
}

Table reviews {
  id bigint [pk, increment]

  appointment_id bigint [not null, unique]
  rating int [not null]
  comment text

  created_at timestamp [not null]
}

Table salon_settings {
  id bigint [pk, increment]

  salon_name varchar(255) [not null]
  phone varchar(20)
  email varchar(255)
  address varchar(500)
  opening_time varchar(5)
  closing_time varchar(5)
  logo_url varchar(1000)

  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table business_hours {
  id bigint [pk, increment]

  day_of_week int [not null]
  open_time varchar(5)
  close_time varchar(5)
  is_closed boolean [not null, default: false]

  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (day_of_week) [unique]
  }
}

Table product_categories {
  id bigint [pk, increment]

  name varchar(255) [not null, unique]
  description text

  created_at timestamp [not null]
}

Table products {
  id bigint [pk, increment]

  category_id bigint
  name varchar(255) [not null]
  brand varchar(255)
  description text
  sku varchar(100) [unique]
  purchase_price decimal(10,2)
  selling_price decimal(10,2) [not null]
  stock_quantity int [not null]
  min_stock_quantity int [not null]
  is_active boolean [not null, default: true]

  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table product_sales {
  id bigint [pk, increment]

  client_id bigint
  employee_id bigint
  total_amount decimal(10,2) [not null]
  sale_date timestamp [not null]

  created_at timestamp [not null]
}

Table product_sale_items {
  sale_id bigint [not null]
  product_id bigint [not null]
  quantity int [not null]
  unit_price decimal(10,2) [not null]

  indexes {
    (sale_id, product_id) [pk]
  }
}

Table stock_movements {
  id bigint [pk, increment]

  product_id bigint [not null]
  movement_type StockMovementType [not null]
  quantity int [not null]
  reason text

  created_at timestamp [not null]
}

Table notification_logs {
  id bigint [pk, increment]

  user_id bigint
  appointment_id bigint
  channel varchar(50) [not null]
  notification_type varchar(50) [not null]
  recipient varchar(255) [not null]
  subject varchar(255)
  status varchar(50) [not null]
  message text
  error_message text
  scheduled_for timestamp
  sent_at timestamp

  created_at timestamp [not null]
}

Table report_export_logs {
  id bigint [pk, increment]

  admin_user_id bigint [not null]
  report_type varchar(100) [not null]
  filters text
  file_name varchar(255)

  created_at timestamp [not null]
}

Ref: employees.user_id > users.id [delete: cascade]

Ref: services.category_id > service_categories.id [delete: set null]

Ref: employee_services.employee_id > employees.id [delete: cascade]
Ref: employee_services.service_id > services.id [delete: cascade]

Ref: appointments.client_id > users.id
Ref: appointments.employee_id > employees.id

Ref: appointment_services.appointment_id > appointments.id [delete: cascade]
Ref: appointment_services.service_id > services.id

Ref: working_hours.employee_id > employees.id [delete: cascade]
Ref: employee_time_off.employee_id > employees.id [delete: cascade]

Ref: payments.appointment_id > appointments.id [delete: cascade]
Ref: payments.product_sale_id > product_sales.id [delete: cascade]

Ref: portfolio_photos.employee_id > employees.id [delete: cascade]
Ref: reviews.appointment_id > appointments.id [delete: cascade]

Ref: products.category_id > product_categories.id

Ref: product_sales.client_id > users.id
Ref: product_sales.employee_id > employees.id

Ref: product_sale_items.sale_id > product_sales.id [delete: cascade]
Ref: product_sale_items.product_id > products.id

Ref: stock_movements.product_id > products.id [delete: cascade]

Ref: notification_logs.user_id > users.id
Ref: notification_logs.appointment_id > appointments.id

Ref: report_export_logs.admin_user_id > users.id
