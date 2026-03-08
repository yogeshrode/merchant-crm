

## Setup Instructions (MacBook)

### Step 1: Install Prerequisites

Open Terminal and run these commands:

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20
brew install node@20

# Add Node to PATH
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify Node installation
node --version  # Should show v20.x.x
npm --version

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify PostgreSQL is running
brew services list | grep postgresql
```

### Step 2: Create Database

```bash
# Create database
createdb merchant_crm

# Verify database was created
psql -l | grep merchant_crm
```

### Step 3: Clone and Setup Project

```bash
# Navigate to where you want the project
cd ~/Documents  # or wherever you prefer


cd merchant-crm

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your database credentials
# Use any text editor, for example:
open -e .env
```

### Step 4: Configure Environment Variables

Edit the `.env` file with these values:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=merchant_crm
DB_USER=your_mac_username
DB_PASSWORD=  # leave empty if no password set

# JWT Configuration (generate random strings for secrets)
JWT_SECRET=your_random_secret_key_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=another_random_secret_here
REFRESH_TOKEN_EXPIRES_IN=7d

# Webhook Configuration
WEBHOOK_SECRET=webhook_signing_secret_here
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY_MS=5000

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# Server
PORT=3000
NODE_ENV=development
```

To generate random secrets, run:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 5: Run Database Migrations

```bash
npm run migrate
```


### Step 6: Create Default Admin User

```bash
# Start the server in one terminal
npm run dev

# In another terminal, create admin using curl or Postman
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@yqnpay.com",
    "password": "admin123",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

### Step 7: Run Tests

```bash
# Run all tests with coverage
npm test
```

### Step 8: Start the Server

```bash


# Production mode
npm start
```


---

## API Endpoints

### Authentication

| Method | Endpoint | Description |

| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/refresh` | Get new access token |
| POST | `/api/auth/logout` | Logout and revoke token |
| GET | `/api/auth/me` | Get current user info |

### Merchants

| Method | Endpoint | Description |

| POST | `/api/merchants` | Create new merchant |
| GET | `/api/merchants` | List all merchants (with filters) |
| GET | `/api/merchants/:id` | Get merchant details |
| PATCH | `/api/merchants/:id` | Update merchant |
| DELETE | `/api/merchants/:id` | Delete merchant (admin only) |
| PATCH | `/api/merchants/:id/status` | Change merchant status |

### Documents

| Method | Endpoint | Description |

| POST | `/api/merchants/:id/documents` | Upload document |
| GET | `/api/merchants/:id/documents` | List documents |
| PATCH | `/api/merchants/:id/documents/:docId/verify` | Verify/reject document |
| DELETE | `/api/merchants/:id/documents/:docId` | Delete document (admin only) |

### Audit Logs

| Method | Endpoint | Description |

| GET | `/api/merchants/:id/history` | Get merchant audit history |

### Webhooks

| Method | Endpoint | Description |

| POST | `/api/webhooks` | Register webhook (admin only) |
| GET | `/api/webhooks/deliveries` | Get delivery history (admin only) |

---

I have attached my postman collection in the email to help you run all these endpoints.