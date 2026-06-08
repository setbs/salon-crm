Table users {
  id bigint [pk, increment]

  first_name varchar(100) [not null]
  last_name varchar(100) [not null]

  phone varchar(20) [not null]
  email varchar(255) [unique]

  password_hash varchar(255)

  role varchar(20) [not null]

  created_at timestamp
  updated_at timestamp
}

Table employees {
  id bigint [pk, increment]

  user_id bigint [not null, unique]

  specialization varchar(255)
  description text

  is_active boolean

  created_at timestamp
}

Table services {
  id bigint [pk, increment]

  name varchar(255) [not null]
  description text

  duration_minutes int [not null]

  price decimal(10,2) [not null]

  is_active boolean

  created_at timestamp
}

Table appointments {
  id bigint [pk, increment]

  client_id bigint [not null]
  employee_id bigint [not null]

  start_time timestamp [not null]
  end_time timestamp [not null]

  status varchar(30) [not null]

  client_comment text
  employee_comment text

  created_at timestamp
  updated_at timestamp
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

  start_time time [not null]
  end_time time [not null]
}

Table payments {
  id bigint [pk, increment]

  appointment_id bigint [not null]

  amount decimal(10,2) [not null]

  payment_method varchar(50)
  payment_status varchar(50)

  paid_at timestamp
}

Table portfolio_photos {
  id bigint [pk, increment]

  employee_id bigint [not null]

  image_url varchar(1000) [not null]

  description text

  created_at timestamp
}

Table reviews {
  id bigint [pk, increment]

  appointment_id bigint [not null]

  rating int [not null]

  comment text

  created_at timestamp

}

Table salon_settings {
  id bigint [pk, increment]

  salon_name varchar(255) [not null]

  phone varchar(20)
  email varchar(255)

  address varchar(500)

  opening_time time
  closing_time time

  logo_url varchar(1000)

  created_at timestamp
  updated_at timestamp
}
Table business_hours {
  id bigint [pk, increment]

  day_of_week int [not null]

  open_time time
  close_time time

  is_closed boolean [not null]

  created_at timestamp
  updated_at timestamp
}

Table employee_time_off {
  id bigint [pk, increment]

  employee_id bigint [not null]

  start_time timestamp [not null]
  end_time timestamp [not null]

  reason text

  created_at timestamp
}

Table refresh_tokens {
  id bigint [pk, increment]

  user_id bigint [not null]

  token varchar(1000) [not null]
  expires_at timestamp [not null]

  created_at timestamp
}

Table notification_logs {
  id bigint [pk, increment]

  user_id bigint [not null]

  notification_type varchar(50) [not null]
  status varchar(50) [not null]

  message text

  sent_at timestamp
  created_at timestamp
}
Table product_categories {
  id bigint [pk, increment]

  name varchar(255) [not null]
  description text

  created_at timestamp
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

  is_active boolean [not null]

  created_at timestamp
  updated_at timestamp
}

Table product_sales {
  id bigint [pk, increment]

  client_id bigint
  employee_id bigint

  total_amount decimal(10,2) [not null]

  sale_date timestamp [not null]
  created_at timestamp
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

  movement_type varchar(50) [not null]
  quantity int [not null]

  reason text

  created_at timestamp
}

Ref: products.category_id > product_categories.id

Ref: product_sales.client_id > users.id
Ref: product_sales.employee_id > employees.id

Ref: product_sale_items.sale_id > product_sales.id
Ref: product_sale_items.product_id > products.id

Ref: stock_movements.product_id > products.id

Ref: employee_time_off.employee_id > employees.id
Ref: refresh_tokens.user_id > users.id
Ref: notification_logs.user_id > users.id

Ref: employees.user_id > users.id

Ref: appointments.client_id > users.id
Ref: appointments.employee_id > employees.id

Ref: appointment_services.appointment_id > appointments.id
Ref: appointment_services.service_id > services.id

Ref: working_hours.employee_id > employees.id

Ref: payments.appointment_id > appointments.id

Ref: portfolio_photos.employee_id > employees.id

Ref: reviews.appointment_id > appointments.id