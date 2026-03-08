-- Documents table: stores KYB document information
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('business_registration', 'owner_identity', 'bank_account_proof')),
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    verified_by INTEGER REFERENCES operators(id),
    verified_at TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(merchant_id, document_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_merchant ON documents(merchant_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
