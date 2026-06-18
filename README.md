# 📦 Stationery Hub

A production-ready web application for a stationery shop in Basundhara, Dhaka. Browse products, create AI-powered quotations from purchase orders, manage orders, and run your business end-to-end.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Go (Chi router) |
| Database | PostgreSQL (pgx driver) |
| Auth | JWT + bcrypt + OTP email verification |
| PDF | fpdf (Go) |
| Email | SMTP via gomail |

## 📁 Project Structure

```
Stationery Hub/
├── frontend/              # React + Vite app
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route pages (auth, catalog, dashboard, admin)
│       ├── context/       # Auth context provider
│       └── services/      # API client (axios)
├── backend-go/            # Go API server
│   ├── cmd/server/        # Entry point (main.go)
│   └── internal/
│       ├── config/        # App & database configuration
│       ├── handlers/      # HTTP handlers (controllers)
│       ├── middleware/     # Auth, CORS, error recovery
│       ├── models/        # Data models / structs
│       ├── router/        # Chi route definitions
│       └── services/      # Email, PDF, OCR, matching
├── prisma/                # Database schema & seed script
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites
- **Go 1.21+** installed
- **Node.js 18+** installed
- **PostgreSQL 14+** installed and running
- A Gmail account with App Password (for SMTP)

### 1. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE stationery_hub;
```

### 2. Backend Setup (Go)

```bash
cd backend-go

# Configure environment
# Copy .env.example to .env and update:
#   - DATABASE_URL with your PostgreSQL credentials
#   - JWT_SECRET with a strong secret key
#   - SMTP_USER and SMTP_PASS with your Gmail App Password

# Download Go dependencies
go mod download

# Start the backend server
go run cmd/server/main.go
```

The API server starts at `http://localhost:5000`.

### 3. Database Seeding

```bash
# From the project root
cd prisma

# Install seed dependencies (if not already)
npm install

# Run seed script
node seed.js
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

The frontend starts at `http://localhost:5173`.

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@stationeryhub.com | admin123 |
| Staff | staff@stationeryhub.com | staff123 |
| Customer | customer@example.com | customer123 |

## 📝 Available Scripts

### Backend (Go)
- `go run cmd/server/main.go` — Start the API server
- `go build cmd/server/main.go` — Build production binary

### Frontend
- `npm run dev` — Start dev server with hot reload
- `npm run build` — Production build
- `npm run preview` — Preview production build

### Database
- `npx prisma db push` — Push schema to database
- `node prisma/seed.js` — Seed sample data
- `npx prisma studio` — Open Prisma Studio (GUI)

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/verify-otp` | Verify email with OTP |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/verify-reset-otp` | Verify reset OTP |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user (🔒) |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (search, filter, paginate) |
| GET | `/api/products/:id` | Get product details |
| GET | `/api/products/admin/all` | List all including inactive (🔒 Staff+) |
| POST | `/api/products` | Create product (🔒 Admin) |
| PUT | `/api/products/:id` | Update product (🔒 Admin) |
| DELETE | `/api/products/:id` | Soft delete product (🔒 Admin) |
| DELETE | `/api/products/:id/permanent` | Permanent delete (🔒 Admin) |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| GET | `/api/categories/:id` | Get category |
| POST | `/api/categories` | Create category (🔒 Admin) |
| PUT | `/api/categories/:id` | Update category (🔒 Admin) |
| DELETE | `/api/categories/:id` | Delete category (🔒 Admin) |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (🔒 Staff+) |
| GET | `/api/customers/:id` | Get customer (🔒 Staff+) |
| POST | `/api/customers` | Create customer (🔒 Staff+) |
| PUT | `/api/customers/:id` | Update customer (🔒 Staff+) |
| DELETE | `/api/customers/:id` | Delete customer (🔒 Admin) |

### Quotations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quotations` | List quotations (🔒 Staff+) |
| GET | `/api/quotations/:id` | Get quotation (🔒) |
| POST | `/api/quotations` | Create quotation (🔒) |
| PUT | `/api/quotations/:id` | Update quotation (🔒 Staff+) |
| POST | `/api/quotations/:id/convert` | Convert to order (🔒 Staff+) |
| GET | `/api/quotations/:id/pdf` | Download PDF (🔒) |
| DELETE | `/api/quotations/:id` | Delete quotation (🔒 Admin) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List orders (🔒 Staff+) |
| GET | `/api/orders/my` | My orders (🔒) |
| GET | `/api/orders/new-count` | New order count (🔒 Staff+) |
| GET | `/api/orders/:id` | Get order (🔒) |
| GET | `/api/orders/:id/timeline` | Order timeline (🔒) |
| PUT | `/api/orders/:id/status` | Update status (🔒 Staff+) |
| PUT | `/api/orders/:id/cancel` | Cancel order (🔒) |

### Checkout
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checkout` | Place order (🔒) |
| POST | `/api/checkout/validate-promo` | Validate promo code (🔒) |

### Dashboard (🔒 Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET | `/api/dashboard/analytics` | Analytics data |
| GET | `/api/dashboard/users` | List users |
| PUT | `/api/dashboard/users/:id/role` | Change user role |
| DELETE | `/api/dashboard/users/:id` | Delete user |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan/upload` | Upload PO for OCR (🔒 Staff+) |
| POST | `/api/scan/:id/create-quotation` | Create quotation from scan (🔒 Staff+) |
| GET | `/api/reviews/product/:id` | Get product reviews |
| POST | `/api/reviews/product/:id` | Create review (🔒) |
| DELETE | `/api/reviews/:id` | Delete review (🔒) |
| GET | `/api/wishlist` | Get wishlist (🔒) |
| POST | `/api/wishlist/:productId` | Toggle wishlist (🔒) |
| GET | `/api/promos` | List promo codes (🔒 Admin) |
| POST | `/api/promos` | Create promo (🔒 Admin) |
| GET | `/api/referrals/my-code` | Get referral code (🔒) |

> 🔒 = Requires authentication · Staff+ = Staff or Admin

## 📄 License

Private — All rights reserved.
