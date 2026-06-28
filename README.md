# Rota App

Rota App is a simple mobile-friendly rota planner for small businesses and SMEs.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite
- Styling: Tailwind CSS
- Services: No paid services

## Features

- Staff management with add, edit and deactivate actions
- Login for admin and staff users
- Admin branding settings for business name and logo
- Change password for admin and staff
- Admin user management with password reset and login disable
- Business opening hours for shift planning
- Staff availability and time-off requests
- My Shifts view for staff
- Copy week, print/PDF rota, PWA install support and audit log
- Shift planner with break minutes, reminder minutes, notes and paid-hour calculations
- Monday to Sunday weekly rota view
- Upcoming reminders dashboard
- Backend field ready for `googleCalendarEventId`
- Seed data with 1 manager, 4 staff members and a week of shifts

## Run The App

Install dependencies:

```bash
npm install
```

This uses npm workspaces and installs both `backend` and `frontend` dependencies.

Run the backend:

```bash
cd backend
npm start
```

The API runs on:

```text
http://localhost:5000
```

Run the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

The Vite app runs on:

```text
http://localhost:5173
```

## API Endpoints

- `GET /`
- `GET /health`
- `GET /api`
- `GET /api/health`
- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `GET /api/shifts/week?startDate=yyyy-mm-dd`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `GET /api/reminders/upcoming`
- `GET /api/notifications`
- `POST /api/notifications/read-all`

Useful public checks:

```text
http://localhost:5000/
http://localhost:5000/health
http://localhost:5000/api
```

## Notes

The SQLite database file is created automatically at `backend/fuelops.sqlite`. If the database is empty, the backend seeds sample staff and shifts on startup.

Node 22.5 or newer is recommended because the backend uses Node's built-in SQLite support.

## Default Logins

Admin:

```text
username: admin
password: admin123
```

Staff:

```text
username: afridi, veera or viththi
password: staff123
```

When a new staff member is added, the app creates a staff login automatically using their name as the username and `staff123` as the first password.

## Railway Hosting

For a single Railway service that serves the built frontend from Express, use:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Railway provides `PORT` automatically. The backend also supports:

```text
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url
DB_PATH=/data/fuelops.sqlite
ADMIN_RESET_TOKEN=use-only-temporarily-for-admin-recovery
```

This app currently uses SQLite through `DB_PATH`. If you later move to a hosted SQL database, add `DATABASE_URL` support before setting that variable. Authentication uses server-side sessions and HTTP-only cookies, so there is no `JWT_SECRET` requirement in the current code.

Add a Railway volume mounted at:

```text
/data
```

Add this backend environment variable so SQLite data survives redeploys:

```text
DB_PATH=/data/fuelops.sqlite
```

If frontend and backend are deployed as separate Railway services, add this variable to the frontend service:

```text
VITE_API_BASE=https://your-backend-url.up.railway.app
```

Also set `FRONTEND_URL` on the backend service to the deployed frontend URL so CORS allows browser requests with cookies.

## Forgotten Admin Password

For production recovery, set a temporary `ADMIN_RESET_TOKEN` on the backend service, redeploy, then call:

```bash
curl -X POST https://your-backend-url/api/auth/recover-admin \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"YOUR_RESET_TOKEN\",\"username\":\"admin\",\"newPassword\":\"NewPassword123\"}"
```

Log in with the new password. The app will force a password change immediately. Remove `ADMIN_RESET_TOKEN` from Railway after recovery.
