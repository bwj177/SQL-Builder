CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  user_name VARCHAR(128),
  country VARCHAR(32),
  signup_date DATE,
  is_vip BOOLEAN
);

CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT,
  order_status VARCHAR(32),
  biz_line VARCHAR(64),
  pay_amount DECIMAL(18,2),
  discount_amount DECIMAL(18,2),
  pay_date DATE,
  created_at TIMESTAMP
);

CREATE TABLE order_items (
  item_id BIGINT PRIMARY KEY,
  order_id BIGINT,
  sku_id BIGINT,
  category_name VARCHAR(128),
  quantity INT,
  item_amount DECIMAL(18,2)
);

CREATE TABLE refunds (
  refund_id BIGINT PRIMARY KEY,
  order_id BIGINT,
  refund_amount DECIMAL(18,2),
  refund_reason VARCHAR(255),
  refund_date DATE
);
