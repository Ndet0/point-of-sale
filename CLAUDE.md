# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (monorepo)
```bash
npm install          # Install all workspace dependencies
npm run dev          # Run backend + frontend concurrently
npm run build        # Build both services
npm run lint         # Lint both services
npm run db:migrate   # Apply pending Prisma migrations
npm run db:studio    # Open Prisma Studio UI (inspect DB)
npm run db:seed      # Seed database with demo data
```

### Backend only (`cd backend/`)
```bash
npm run dev          # tsx watch mode
npm run build        # tsc → dist/
npm run db:generate  # Regenerate Prisma client after schema changes
```

### Frontend only (`cd frontend/`)
```bash
npm run dev          # Vite dev server on :5173
npm run build        # Vite production build
npm run preview      # Preview production build
```

### Docker (full stack)
```bash
docker-compose up --build   # Start postgres, backend, frontend, pgadmin
docker-compose down
```

There are no automated tests in this codebase yet.

## Architecture Overview

**Monorepo layout**: `backend/` (Express + TypeScript) + `frontend/` (React + Vite + TypeScript). The `shared/` directory exists but is currently empty.

### Backend (`backend/src/`)

Express app with a layered architecture:

- **`routes/`** → **`controllers/`** → **`services/`** → **`lib/prisma.ts`** (Prisma ORM)
- **`adapters/`**: M-Pesa payment integration using the Adapter pattern. `MpesaAdapter` is an abstract base; `MockMpesaAdapter` (dev) and `LiveMpesaAdapter` (production) are selected via the `MPESA_ADAPTER` env var.
- **`middleware/`**: JWT auth, role checks (ADMIN/CASHIER), error handling, M-Pesa callback signature validation.
- **`jobs/`**: Cron job runs every minute to auto-abandon PENDING sales that exceed the configured timeout, releasing reserved stock.
- **`config/`**: Zod validates all environment variables at startup — the app will not start with a bad config.

**Key transactional pattern**: Stock uses `stockQuantity` (actual) and `reservedQuantity` (held by PENDING sales). Creating a sale atomically reserves stock via Prisma transactions with row-level locking. Cancellation/abandonment releases it. This prevents overselling.

**Sale lifecycle**: `PENDING → COMPLETED | CANCELLED | ABANDONED`

**Payment flow**: STK push to customer phone → async M-Pesa callback webhook → `MpesaCallbackLog` for idempotency → sale marked COMPLETED. A fallback STK query handles cases where the callback is missed.

### Frontend (`frontend/src/`)

- **`pages/`**: `POSPage` (main checkout), `InventoryPage`, `SalesPage`, `SettingsPage`, auth pages.
- **`stores/`**: Zustand stores for auth state (with JWT) and cart (localStorage-persisted).
- **`db/`**: Dexie (IndexedDB) for local product caching — enables offline browsing of inventory.
- **`sync/`**: Sync queue that flushes pending operations when connectivity is restored.
- **`lib/api.ts`**: Axios instance targeting `VITE_API_BASE_URL` with JWT in Authorization header.
- React Query handles server-state caching and invalidation.

### Database (PostgreSQL + Prisma)

**Multi-tenancy**: Every model (User, Product, Sale, Payment, etc.) is scoped to a `businessId`. A `Business` is the root tenant.

**BusinessSettings**: Per-tenant config including tax rate, currency, and sale timeout mode (`fixed` minutes or `pickup_window` based on business hours). This is the first thing to check when sale timeout behavior seems unexpected.

**Schema changes**: After editing `prisma/schema.prisma`, run `npm run db:generate` to regenerate the Prisma client, then `npm run db:migrate` to apply.

### Environment

Copy `.env.example` to `.env`. Key variables:
- `MPESA_ADAPTER=mock` — use this in development (no real M-Pesa credentials needed)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — must be ≥32 chars
- `MPESA_CALLBACK_BASE_URL` — must be an HTTPS URL; use ngrok when testing live M-Pesa locally
- `FRONTEND_URL` — sets the CORS allowed origin on the backend

### Security model
- Access tokens (15m) in `Authorization: Bearer` header; refresh tokens (7d) in httpOnly cookies.
- Routes are protected by role: `ADMIN` routes require the admin middleware; cashier routes just require auth.
- All data queries must filter by `businessId` to maintain tenant isolation — this is enforced in service layer, not Prisma middleware.
