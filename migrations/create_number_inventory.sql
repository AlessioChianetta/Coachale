CREATE TABLE IF NOT EXISTS number_inventory (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR NOT NULL UNIQUE,
  country_code VARCHAR DEFAULT 'IT',
  prefix VARCHAR,
  telnyx_order_id VARCHAR,
  connection_id VARCHAR,
  status VARCHAR DEFAULT 'available',
  assigned_to VARCHAR REFERENCES users(id),
  assigned_at TIMESTAMP,
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchased_by VARCHAR REFERENCES users(id),
  monthly_cost DECIMAL(10,4),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_number_inventory_status ON number_inventory(status);
CREATE INDEX IF NOT EXISTS idx_number_inventory_assigned_to ON number_inventory(assigned_to);
CREATE INDEX IF NOT EXISTS idx_number_inventory_prefix ON number_inventory(prefix);
