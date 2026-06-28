# FuelOps Rota

FuelOps Rota is a mobile-friendly rota, staff, time-off, and reminder app for small UK businesses. It was originally built for a UK fuel station, but the branding can be changed from the admin settings so other SMEs can use it too.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite
- Styling: Tailwind CSS
- Hosting: Railway-compatible
- Paid services: none required

## Main Features

- Admin and staff login
- Forced password change after first login or password reset
- HTTP-only secure session cookies
- Rate-limited login attempts
- Staff management: add, edit, deactivate
- Admin user management: create login, reset password, disable login, choose admin/staff role
- Business branding: business name and logo
- Business opening hours
- Weekly rota from Monday to Sunday
- Permanent rota seed pattern through the end of the year
- Extra cover shifts when someone is off
- Shift notes editable from the rota
- Staff availability warnings
- Time-off requests with admin approval/rejection
- Approved time off removes affected staff shifts from rota totals
- Staff-only My Shifts page
- Upcoming reminders and rota change notifications
- WhatsApp reminder/share buttons
- Print/PDF weekly rota
- Copy week to next week
- Audit log
- PWA install support

## UK Standards

- Weeks start on Monday and end on Sunday.
- Dates are displayed in UK style, for example `28 Jun 2026`.
- Times use the shop-friendly rota style, for example `5.30am-10pm`.
- Reminder/notification timestamps use UK locale formatting.
- Phone examples use UK mobile format, for example `07123 456789`.

## Project Structure

```text
fuelops-rota/
  backend/
    src/
      db.js
      server.js
    package.json
  frontend/
    src/
      pages/
      components/
      api.js
      dateUtils.js
    package.json
  tests/
    smoke.mjs
  package.json
  README.md
```

## Requirements

- Node.js 22.5 or newer
- npm

Node 22.5+ is required because the backend uses Node's built-in SQLite module.

## Local Setup

Install dependencies from the project root:

```bash
npm install
```

Run the backend:

```bash
npm start
```

The backend runs on:

```text
http://localhost:5000
```

Run the frontend in a second terminal:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

Useful local checks:

```text
http://localhost:5000/
http://localhost:5000/health
http://localhost:5000/api
```

## Scripts

From the project root:

```bash
npm start
```

Starts the backend.

```bash
npm run dev
```

Starts the Vite frontend.

```bash
npm run build
```

Builds the frontend for production.

```bash
npm run smoke
```

Runs an end-to-end smoke test against a temporary SQLite database.

## Database

The app uses SQLite.

Local default database:

```text
backend/fuelops.sqlite
```

Production recommended database path:

```text
/data/fuelops.sqlite
```

On first startup, the backend creates the database tables and seeds sample staff, logins, and rota data if the database is empty.

## First Login

Default setup logins exist only so the first admin/staff users can get into the app and set real passwords.

Admin:

```text
username: admin
password: admin123
```

Staff examples:

```text
username: afridi, veera or viththi
password: staff123
```

After login, the app forces a password change before the rota can be used.

When a new staff member is added, the app creates a staff login automatically using their name as the username and `staff123` as the temporary password.

## Security Notes

- Session tokens are stored in HTTP-only cookies.
- Login attempts are rate-limited.
- Temporary/default passwords force a change before normal app use.
- Staff users only see their own shifts and relevant notifications.
- Admin-only routes are protected server-side.
- Admin recovery is disabled unless `ADMIN_RESET_TOKEN` is set.

## Environment Variables

Backend:

```text
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url
DB_PATH=/data/fuelops.sqlite
ADMIN_RESET_TOKEN=temporary-secret-for-admin-recovery
```

Frontend:

```text
VITE_API_BASE=https://your-backend-url.up.railway.app
```

Notes:

- Railway provides `PORT` automatically.
- `DB_PATH` should point to a Railway volume path in production.
- `ADMIN_RESET_TOKEN` should only be added temporarily when recovering admin access.
- This app uses server-side sessions, not JWT, so `JWT_SECRET` is not required.
- `DATABASE_URL` is not used unless the app is later migrated from SQLite to a hosted SQL database.

## Railway Deployment

### Single Service

A single Railway service can serve both backend API and the built frontend.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Add a Railway volume mounted at:

```text
/data
```

Set:

```text
DB_PATH=/data/fuelops.sqlite
NODE_ENV=production
```

### Separate Frontend And Backend Services

Backend service:

```text
DB_PATH=/data/fuelops.sqlite
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url
```

Frontend service:

```text
VITE_API_BASE=https://your-backend-url.up.railway.app
```

Because login uses cookies, `FRONTEND_URL` must match the deployed frontend URL so CORS can allow credentialed requests.

## Forgotten Admin Password

Use this only when you cannot log in as admin.

1. In Railway backend variables, add a temporary reset token:

```text
ADMIN_RESET_TOKEN=make-a-long-random-secret
```

2. Wait for the backend to redeploy.

3. From PowerShell, run:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://your-backend-url/api/auth/recover-admin" `
  -ContentType "application/json" `
  -Body '{"token":"make-a-long-random-secret","username":"admin","newPassword":"NewPassword123"}'
```

4. Log in with the new password.

5. The app will force another password change.

6. Remove `ADMIN_RESET_TOKEN` from Railway after recovery.

If the request returns `502 Application failed to respond`, check Railway deploy logs first. A wrong token should return `403`, not `502`.

## API Overview

Public/status routes:

- `GET /`
- `GET /health`
- `GET /api`
- `GET /api/health`
- `GET /api/settings/branding`
- `POST /api/auth/login`
- `POST /api/auth/recover-admin`

Authenticated routes:

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `POST /api/users/:id/reset-password`
- `GET /api/shifts/week?startDate=yyyy-mm-dd`
- `GET /api/shifts/my`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `POST /api/shifts/copy-week`
- `GET /api/reminders/upcoming`
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `GET /api/time-off`
- `POST /api/time-off`
- `PUT /api/time-off/:id`
- `GET /api/availability`
- `POST /api/availability`
- `DELETE /api/availability/:id`
- `GET /api/audit`
- `GET /api/settings/opening-hours`
- `PUT /api/settings/opening-hours`
- `PUT /api/settings/branding`

## Common Workflows

### Add Staff

1. Admin opens Staff.
2. Add staff member with name, phone, email, role, and active status.
3. A temporary staff login is created automatically.
4. Staff logs in and changes password.

### Add Shift

1. Admin opens Add Shift.
2. Select staff, date, time range, break, reminder, and notes.
3. The system calculates hours and creates a reminder time.
4. The staff member receives an in-app notification.

### Time Off

1. Staff submits a time-off request.
2. Admin approves or rejects it.
3. Approved time off appears in rota notes.
4. Approved time off removes affected staff shifts from rota totals.

### Print Weekly Rota

1. Open Weekly Rota.
2. Select the correct week.
3. Click Print / PDF.
4. Use landscape layout for the cleanest shop noticeboard print.

## Testing Before Deployment

Run:

```bash
npm run smoke
npm run build
```

Both should pass before pushing changes to Railway.

## Troubleshooting

### Railway shows `502 Application failed to respond`

Check:

- Railway deployment logs
- Node version is 22.5+
- `DB_PATH` points to a mounted writable volume
- Build/start commands are correct
- The latest GitHub commit deployed successfully

### Frontend cannot log in

Check:

- Backend is online
- `VITE_API_BASE` points to the backend URL
- Backend `FRONTEND_URL` matches the frontend URL
- Browser is using HTTPS on production

### Rota data disappears after deploy

SQLite is probably stored on the temporary filesystem. Add a Railway volume and set:

```text
DB_PATH=/data/fuelops.sqlite
```

## Current Production Notes

- The app is designed for UK SME rota use.
- The original seed rota includes VITHTHI, Afridi, and Veera.
- The permanent rota is generated through the current year and can be changed by the manager/admin.
