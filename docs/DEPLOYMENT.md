# Live Deployment Guide — Ubuntu VPS

Deploys the full stack (PostgreSQL, API, SPA, Nginx, SSL) with Docker Compose on a fresh Ubuntu 22.04/24.04 VPS.

## 1. Prerequisites

- Ubuntu VPS (2 GB RAM minimum) with a public IP
- Domain DNS: create an `A` record `inventory.nationwide-paper.com → <VPS IP>`
- Azure AD app registration for Microsoft 365 login (step 5)

## 2. Server preparation

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw

# Docker
curl -fsSL https://get.docker.com | sh

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 3. Get the code

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/YOUR_ORG/it-inventory-portal.git
cd it-inventory-portal
```

## 4. Configuration

```bash
cp .env.example .env                      # set DB_PASSWORD (strong random)
cp backend/.env.example backend/.env
nano backend/.env
```

In `backend/.env` set at minimum:

- `JWT_SECRET` — `openssl rand -hex 32`
- `APP_URL` / `API_URL` / `MS_REDIRECT_URI` — your real domain
- `SMTP_*` — your Microsoft 365 SMTP credentials
- `IT_MANAGER_EMAIL`, `TEAMS_WEBHOOK_URL`
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` (step 5)

## 5. Microsoft 365 login (Azure AD)

1. Azure Portal → Microsoft Entra ID → App registrations → **New registration**
2. Name: `NP IT Inventory` · Supported accounts: *Single tenant*
3. Redirect URI (Web): `https://inventory.nationwide-paper.com/api/auth/microsoft/callback`
4. Copy **Application (client) ID** → `MS_CLIENT_ID`, **Directory (tenant) ID** → `MS_TENANT_ID`
5. Certificates & secrets → New client secret → copy value → `MS_CLIENT_SECRET`
6. API permissions → Microsoft Graph → Delegated → `User.Read` → Grant admin consent

## 6. First-time SSL certificate

Nginx needs a certificate before it can start on 443, so issue it once with a temporary web server:

```bash
docker run --rm -p 80:80 -v certbot-conf:/etc/letsencrypt certbot/certbot certonly \
  --standalone -d inventory.nationwide-paper.com \
  --email raj@nationwide-paper.com --agree-tos --no-eff-email
```

(The `certbot` service in docker-compose renews it automatically every 12 h afterwards.)

Note: the compose file prefixes volume names with the project directory name. If nginx cannot find certificates, check `docker volume ls` and ensure the certbot volume name used above matches (e.g. `it-inventory-portal_certbot-conf`) — or run the command after `docker compose up` created the volumes:
`docker compose run --rm --service-ports certbot certonly --standalone -d inventory.nationwide-paper.com --email raj@nationwide-paper.com --agree-tos --no-eff-email` (stop nginx first).

## 7. Launch

```bash
docker compose build
docker compose up -d
docker compose logs -f api   # wait for "IT Inventory API listening"
```

Migrations run and the database is seeded automatically on API start.
Open `https://inventory.nationwide-paper.com`, sign in as `admin@nationwide-paper.com` / `ChangeMe!2026`, then **immediately change the password** and create your team's accounts.

## 8. GitHub auto-deployment (optional)

`.github/workflows/deploy.yml` redeploys on every push to `main`. In GitHub → repo → Settings → Secrets and variables → Actions, add:

- `VPS_HOST` — server IP
- `VPS_USER` — e.g. `root`
- `VPS_SSH_KEY` — private key whose public half is in `~/.ssh/authorized_keys`

## 9. Operations

```bash
docker compose ps                 # status
docker compose logs -f api        # API logs
docker compose pull && docker compose up -d --build    # update
docker compose exec db psql -U inventory it_inventory  # DB shell
```

Backups: see [BACKUP.md](BACKUP.md).

## 10. Production security checklist

- [ ] Changed the seeded admin password
- [ ] Strong unique `JWT_SECRET` and `DB_PASSWORD`
- [ ] `NODE_ENV=production`
- [ ] Firewall allows only 22/80/443
- [ ] SSH key auth only (`PasswordAuthentication no` in sshd_config)
- [ ] Daily DB backup cron installed (BACKUP.md)
- [ ] SMTP + Teams webhook tested (assign a test asset)
- [ ] Azure AD app restricted to your tenant
