CREATE TABLE product_brands (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products
ADD COLUMN brand_id BIGINT REFERENCES product_brands(id) ON DELETE SET NULL,
ADD COLUMN quote TEXT;

INSERT INTO product_brands (name)
SELECT DISTINCT trim(brand)
FROM products
WHERE brand IS NOT NULL
  AND trim(brand) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE products
SET brand_id = product_brands.id
FROM product_brands
WHERE products.brand = product_brands.name;
