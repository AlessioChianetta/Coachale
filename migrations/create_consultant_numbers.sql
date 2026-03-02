CREATE TABLE IF NOT EXISTS consultant_numbers (
  id SERIAL PRIMARY KEY,
  consultant_id VARCHAR NOT NULL REFERENCES users(id),
  phone_number VARCHAR NOT NULL,
  country_code VARCHAR DEFAULT 'IT',
  prefix VARCHAR,
  telnyx_number_order_id VARCHAR,
  telnyx_did_id VARCHAR,
  connection_id VARCHAR,
  status VARCHAR DEFAULT 'active',
  kyc_status VARCHAR DEFAULT 'pending',
  kyc_deadline TIMESTAMP,
  kyc_submitted_at TIMESTAMP,
  kyc_request_id INTEGER REFERENCES voip_provisioning_requests(id),
  suspended_at TIMESTAMP,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
