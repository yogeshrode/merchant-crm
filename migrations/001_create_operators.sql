-- Operators table: stores admin users who manage merchants
CREATE TABLE IF NOT EXISTS operators (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    is_active BOOLEAN DEFAULT true,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO operators (email, password_hash, first_name, last_name, role)
VALUES (
    'newadmin@yqnpay.com',
    'admin123',
    'System',
    'Admin',
    'admin'
)
ON CONFLICT (email) DO NOTHING;
