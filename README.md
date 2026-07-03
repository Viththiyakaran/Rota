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
- Rota Pattern builder for 1 month, 3 months, 6 months, custom date ranges, or end of year
- Free Rota AI helper to convert pasted rota text into rota pattern rows
- Extra cover shifts when someone is off
- Shift notes editable from the rota
- Staff availability warnings
- Time-off requests with admin approval/rejection
- Shared task board with Backlog, Todo, Process, and Done columns
- Dated tasks reflected in the dashboard rota, weekly rota, and print/PDF notes
- Approved time off removes affected staff shifts from rota totals
- Staff-only My Shifts page
- Upcoming reminders, rota change notifications, and PWA push notifications
- Google Calendar links and phone calendar `.ics` sync
- WhatsApp reminder/share buttons
- Print/PDF weekly rota
- Copy week to next week
- Audit log
- PWA install support

## Documentation

Detailed documentation lives in the `docs/` folder:

- [Admin Guide](docs/ADMIN_GUIDE.md)
- [Staff Guide](docs/STAFF_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API.md)
- [Security And Operations](docs/SECURITY_AND_OPERATIONS.md)

Use the README for quick setup. Use the docs folder for handover, deployment, and day-to-day operating instructions.

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
VAPID_PUBLIC_KEY=optional-fixed-web-push-public-key
VAPID_PRIVATE_KEY=optional-fixed-web-push-private-key
VAPID_SUBJECT=mailto:admin@example.com
```

Frontend:

```text
VITE_API_BASE=https://your-backend-url.up.railway.app
```

Notes:

- Railway provides `PORT` automatically.
- `DB_PATH` should point to a Railway volume path in production.
- `ADMIN_RESET_TOKEN` should only be added temporarily when recovering admin access.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are optional. If they are not set, the app generates and saves free Web Push keys in SQLite.
- For long-term production, fixed VAPID keys are better because existing phone/browser subscriptions remain valid after database restore or migration.
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

## Other Deployment Options

This app currently uses a Node/Express backend and a SQLite database file. For production, choose a backend host that supports persistent storage, or migrate the database to a hosted database before using serverless hosting.

| Platform | Best use | Current app fit | Notes |
| --- | --- | --- | --- |
| Railway | Full-stack single service | Yes | Easiest current setup. Use a volume mounted at `/data` and set `DB_PATH=/data/fuelops.sqlite`. |
| Render | Full-stack web service | Yes, with persistent disk | Use a Node web service and attach a persistent disk. Set `DB_PATH` to the disk mount path. |
| Fly.io | Full-stack app with volumes | Yes, with volume | Good if you are comfortable with CLI deployment. Create a volume and point `DB_PATH` to it. |
| DigitalOcean Droplet/VPS | Long-term full control | Yes | Run Node with PM2 or systemd, use Nginx/Caddy, and back up the SQLite file. |
| DigitalOcean App Platform | Managed app hosting | Possible | Use only if persistent storage or a managed database is configured. |
| Netlify | Frontend only | Partial | Host the React frontend here, keep the backend on Railway/Render/Fly/VPS, and set `VITE_API_BASE`. |
| Vercel | Frontend only | Partial | Same as Netlify. Do not rely on local SQLite inside serverless functions. |
| Cloudflare Pages | Frontend only | Partial | Host the frontend only unless the backend and database are moved elsewhere. |

### Recommended Hosting Order

1. Railway for the simplest full app setup.
2. Render with persistent disk if you want another managed Node host.
3. Fly.io if you are comfortable with CLI deployment and volumes.
4. VPS/Droplet if you want the most control and can manage backups.
5. Netlify/Vercel only for the frontend unless you migrate the backend/database.

### Split Frontend And Backend

If the frontend is hosted separately, set this on the frontend host:

```text
VITE_API_BASE=https://your-backend-url
```

Set this on the backend host:

```text
FRONTEND_URL=https://your-frontend-url
```

The backend URL must use HTTPS in production because login uses secure cookies.

### If You Want Serverless Hosting

Move the database away from local SQLite first. Good future options include Postgres, Supabase, Neon, or Turso/libSQL. After that migration, the frontend can live on Netlify/Vercel and the API can be redesigned for serverless functions.

Official references:

- Railway volumes: https://docs.railway.com/guides/volumes
- Render disks: https://render.com/docs/disks
- Fly.io volumes: https://fly.io/docs/volumes/
- Netlify functions: https://docs.netlify.com/functions/overview/
- Vercel functions: https://vercel.com/docs/functions

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
- `POST /api/rota-patterns/generate`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `POST /api/shifts/copy-week`
- `GET /api/reminders/upcoming`
- `GET /api/push/public-key`
- `GET /api/push/status`
- `POST /api/push/subscribe`
- `POST /api/push/test`
- `GET /api/calendar/my-feed`
- `GET /calendar/:token.ics`
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `GET /api/time-off`
- `POST /api/time-off`
- `PUT /api/time-off/:id`
- `GET /api/availability`
- `POST /api/availability`
- `DELETE /api/availability/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
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

### Rota Pattern

Use this for the normal repeating rota.

1. Admin opens Pattern.
2. Choose the first Monday of the rota.
3. Add the weekly staff shifts, or import the current week.
4. Choose Ends after: 1 month, 3 months, 6 months, End of year, or Custom.
5. Press Generate rota.

Notes:

- Generated pattern shifts are marked internally so they can be replaced later.
- One-off cover shifts are not deleted when replacing generated pattern shifts.
- This is the recommended way to keep a regular rota running without the manager assigning every week manually.

### Rota AI

Use this as a free admin helper when the rota already exists in text or in a screenshot.

1. Admin presses Rota AI from the top header or Dashboard.
2. Paste/type rota text, for example `Monday Afridi 6pm-10pm Shopping`.
3. Optionally upload a rota image as a reference while typing.
4. Press Generate from text.
5. Review detected rows.
6. Press Send to Pattern.
7. Generate the rota from Rota Pattern.

Notes:

- The current helper does not use paid AI services.
- Text parsing happens in the browser.
- Uploaded images are shown as a reference only. Automatic OCR can be added later with a local OCR library or a paid OCR/AI service.

### One-off Shift

Use this for temporary cover, holiday cover, or a single change.

1. Admin opens One-off Shift.
2. Select staff, date, time range, break, reminder, and notes. The default reminder is 30 minutes before the shift.
3. The system calculates hours and creates a reminder time.
4. The staff member receives an in-app notification.
5. If the staff member enabled phone notifications, the backend sends a push reminder 30 minutes before the shift and another notification when the shift starts.

### Enable Phone Notifications

1. Staff logs in on their phone.
2. On iPhone, install the PWA to the home screen first.
3. Open Account.
4. Press Enable Notifications.
5. Allow browser notifications.
6. A test notification confirms that this device is registered.

Notes:

- Push notifications are free and do not require WhatsApp or paid services.
- The app must be served over HTTPS in production for push notifications to work.
- Reminders are checked by the backend every minute.
- If the browser is closed, the phone/browser can still receive the push reminder after notifications are enabled.
- Shift-start notifications stay visible until dismissed and use vibration where supported.
- Browsers and phones control the notification sound; custom alarm sounds are not reliable for closed-browser web push.

### Calendar Sync

Staff can use calendar sync in three ways:

1. Open My Shifts or Reminders.
2. Press Google to add one shift to Google Calendar.
3. Press Phone calendar to download one `.ics` event for Apple Calendar, Outlook, or a phone calendar.
4. Open Account and use Calendar Sync for a private subscription feed of upcoming shifts.

Notes:

- The calendar feed is private per staff login.
- The feed includes upcoming shifts and excludes approved time off.
- Calendar events use the business timezone from Settings. The default is `Europe/London` for UK businesses.
- Each event includes the rota reminder as a calendar alarm.
- Keep the feed URL private because calendar apps use the link without the normal app login cookie.

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

### Task Board

1. Admin or staff opens the task board.
2. Add a task with details, date, assignee, and status.
3. Move tasks between Backlog, Todo, Process, and Done.
4. Dated tasks appear on the matching rota day so shop jobs are visible beside shifts.

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
