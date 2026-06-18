ALTER TABLE products
ADD COLUMN product_purpose VARCHAR(20) NOT NULL DEFAULT 'BOTH';

ALTER TABLE products
ADD CONSTRAINT products_product_purpose_check
CHECK (product_purpose IN ('SALE', 'PROCEDURE', 'BOTH'));
