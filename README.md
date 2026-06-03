# 📦 Stationery Hub

A production-ready web application for a stationery shop. Browse products, create AI-powered quotations from purchase orders, and manage your business.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt + SMTP verification |
| OCR | Tesseract.js (coming in Phase 3) |

## 📁 Project Structure

```
Stationary Hub/
├── frontend/          # React + Vite app
├── backend/           # Node.js + Express API
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ installed and running
- A Gmail account with App Password (for SMTP)

### 1. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE stationery_hub;
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
# Edit .env and update DATABASE_URL with your PostgreSQL credentials
# Update SMTP_USER and SMTP_PASS with your Gmail App Password

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed the database with sample data
npm run db:seed

# Start the backend
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend
npm run dev
```


### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Staff | staff@stationeryhub.com | staff123 |
| Customer | customer@example.com | customer123 |

## 📝 Available Scripts

### Backend
- `npm run dev` — Start with hot reload
- `npm start` — Production start
- `npm run db:push` — Push schema to database
- `npm run db:seed` — Seed sample data
- `npm run db:studio` — Open Prisma Studio (GUI)

### Frontend
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

## 🔑 API Endpoints

### Auth
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `GET /api/auth/verify-email?token=` — Verify email
- `GET /api/auth/me` — Get current user

### Products (Public)
- `GET /api/products` — List products (with search, filter, pagination)
- `GET /api/products/:id` — Get product details

### Products (Admin)
- `GET /api/products/admin/all` — List all products (including inactive)
- `POST /api/products` — Create product
- `PUT /api/products/:id` — Update product
- `DELETE /api/products/:id` — Deactivate product

### Categories
- `GET /api/categories` — List categories
- `POST /api/categories` — Create (Admin)
- `PUT /api/categories/:id` — Update (Admin)
- `DELETE /api/categories/:id` — Delete (Admin)

### Dashboard (Admin)
- `GET /api/dashboard/stats` — Dashboard metrics
- `GET /api/dashboard/users` — List users
- `PUT /api/dashboard/users/:id/role` — Change user role

## 📄 License

Private — All rights reserved.
