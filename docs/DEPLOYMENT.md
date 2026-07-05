# LocalOps Planner Deployment Guide

LocalOps Planner is a React frontend with a Node/Express backend. It supports SQLite for local/simple installs and Supabase/Postgres for production by setting `DATABASE_URL`.

## Requirements

- Node.js 22.5 or newer
- npm
- Supabase/Postgres connection string for production, or a persistent disk/volume if using SQLite

## Local Run

Install dependencies:

```bash
npm install
```

Start backend:

```bash
npm start
```

Start frontend:

```bash
npm run dev
```

Local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:5000
Health:   http://localhost:5000/health
Routes:   http://localhost:5000/api
```

## Production Environment Variables

Backend:

```text
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-url
DB_PATH=/data/fuelops.sqlite
DATABASE_URL=postgresql://...
ADMIN_RESET_TOKEN=temporary-only-if-needed
VAPID_SUBJECT=mailto:admin@example.com
VAPID_PUBLIC_KEY=optional-fixed-key
VAPID_PRIVATE_KEY=optional-fixed-key
```

Frontend:

```text
VITE_API_BASE=https://your-backend-url
```

Notes:

- Railway provides `PORT`.
- Prefer `DATABASE_URL` for Supabase/Postgres production storage.
- Use `DB_PATH` only when running SQLite with persistent storage.
- `ADMIN_RESET_TOKEN` should be removed after admin password recovery.
- `JWT_SECRET` is not required because the app uses server sessions.
- Never paste or commit real database passwords into source control.

## Railway Single-Service Deployment

Use this when one Railway service serves both frontend and backend.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

For Supabase/Postgres, set variables:

```text
NODE_ENV=production
DATABASE_URL=your Supabase connection string
```

The backend creates its required tables on first start.

For SQLite instead, add a Railway volume:

```text
Mount path: /data
DB_PATH=/data/fuelops.sqlite
```

## Railway Split Frontend And Backend

Backend variables:

```text
NODE_ENV=production
DATABASE_URL=your Supabase connection string
FRONTEND_URL=https://your-frontend-url
```

Use `DB_PATH=/data/fuelops.sqlite` only if you are using a Railway volume instead of Supabase.

Frontend variables:

```text
VITE_API_BASE=https://your-backend-url.up.railway.app
```

Frontend build command:

```bash
npm run build --workspace=fuelops-rota-frontend
```

If your Railway workspace uses root build commands, use:

```bash
npm --workspace frontend run build
```

## Railway Watch Paths

If Railway says "No changes to watched files", set watch paths:

Frontend:

```text
/frontend/**
```

Backend:

```text
/backend/**
```

For a single full-stack service, use:

```text
/**
```

## Other Hosting Options

| Platform | Suitable | Notes |
| --- | --- | --- |
| Railway | Yes | Easiest full-stack option. Use a volume. |
| Render | Yes | Use Node web service and persistent disk. |
| Fly.io | Yes | Use volumes. Better for CLI users. |
| VPS/Droplet | Yes | Use PM2/systemd and Nginx/Caddy. |
| Netlify | Frontend only | Backend must remain on Railway/Render/Fly/VPS. |
| Vercel | Frontend only | Backend/database should not use local SQLite in serverless. |
| Cloudflare Pages | Frontend only | Keep API elsewhere. |

## Smoke Test

Run before deployment:

```bash
npm run smoke
npm run build
```

## Backup

Back up the SQLite file:

```text
/data/fuelops.sqlite
```

Back up before:

- Major rota changes
- Database migrations
- Moving host
- Removing Railway volumes
