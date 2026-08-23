-- Seed initial sample product for scan flows
INSERT INTO products (barcode, name, price, weight, image, category)
VALUES (
  '8901234567890',
  'Amul Taaza Milk',
  62.00,
  1.00,
  'milk.jpg',
  'Dairy'
)
ON CONFLICT (barcode) DO NOTHING;
