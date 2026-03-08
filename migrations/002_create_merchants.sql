-- Merchants table: stores business information
CREATE TABLE IF NOT EXISTS merchants (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    business_category VARCHAR(100) NOT NULL,
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    address TEXT,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    pricing_tier VARCHAR(20) DEFAULT 'standard' CHECK (pricing_tier IN ('basic', 'standard', 'premium')),
    status VARCHAR(20) DEFAULT 'pending_kyb' CHECK (status IN ('pending_kyb', 'active', 'suspended')),
    kyb_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster search and filtering
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_city ON merchants(city);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(business_category);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(contact_email);
