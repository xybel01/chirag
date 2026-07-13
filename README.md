# Nationwide Paper Ltd — IT Inventory Management Portal

Production-ready IT asset inventory system for the IT team.

**Stack:** React + Vite + Tailwind CSS · Node.js + Express · PostgreSQL + Prisma · JWT + Microsoft 365 login · Docker + Nginx + Let's Encrypt SSL

## Modules

| Module | Highlights |
|---|---|
| User Management | 6 roles (Admin, IT Manager, IT Support, HR, Accounts, Employee), RBAC, M365 + password login, forgot password |
| Asset Inventory | 17 categories, auto asset tags (`NP-LAP-0001`), invoices & warranty docs, QR + Code128 barcode labels |
| Asset Assignment | Assign / return / transfer / replace / repair / dispose, digital signature, acknowledgement PDF, email to employee + manager, full history |
| Stock Management | Per-category stock matrix, accessories & consumables, low-stock alerts |
| Maintenance & Repair | Tickets, vendor repairs, warranty claims, parts & cost tracking |
| Licenses | M365 / Antivirus / RingCentral / Dynamics 365 / other, seat tracking, expiry alerts, cost tracking |
| Reports | Asset, user-wise, department-wise, warranty expiry, license expiry, repair, purchase — Excel / PDF / print |
| Dashboard | Totals, expiring warranties/licenses, charts by category, department, location |
| Notifications | Email (SMTP) + Microsoft Teams webhook, daily expiry & low-stock cron |
| Audit Log | Every change recorded with user, before/after diff, IP, timestamp |
| Security | Helmet, rate limiting, Zod validation, upload whitelist, bcrypt, authenticated file serving |

## Project structure

```
backend/            Express API
  prisma/           schema.prisma + seed.js
  src/
    config/         env + prisma client
    middleware/     auth, rbac, validate, rateLimit, upload, errorHandler
    controllers/    one per module
    routes/         one per module
    services/       email, teams, codes (QR/barcode), ackForm, exporter, alerts, audit
  scripts/          backup.sh
frontend/           React SPA (Vite + Tailwind)
  src/
    api/ components/ context/ pages/ utils/
nginx/              production reverse proxy config
docs/               API.md, DEPLOYMENT.md, BACKUP.md
docker-compose.yml  db + api + web + nginx + certbot
```

## Quick start (local development)

```bash
# 1. Database
docker run -d --name inv-db -e POSTGRES_DB=it_inventory -e POSTGRES_USER=inventory \
  -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16-alpine

# 2. Backend
cd backend
cp .env.example .env   # set DATABASE_URL=postgresql://inventory:dev@localhost:5432/it_inventory
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev            # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to :5000)
```

Default admin: `admin@nationwide-paper.com` / `ChangeMe!2026` (change immediately).

## Production deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full Ubuntu VPS guide (Docker, Nginx, SSL, GitHub auto-deploy) and [docs/BACKUP.md](docs/BACKUP.md) for backup/restore.

## API

See [docs/API.md](docs/API.md).
