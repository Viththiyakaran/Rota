# LocalOps Planner Complete Product Manual

LocalOps Planner is a mobile-friendly rota planner for UK small businesses. It helps managers build weekly rotas, generate repeating patterns, manage staff, approve time off, share rota information, send reminders, and spot common rota issues.

The app was originally called FuelOps Rota. Businesses can change the name and logo in Settings, so the same app can be used by fuel stations, convenience shops, cafes, takeaways, restaurants, salons, cleaning teams, security teams, warehouses, and other small teams that work by rota.

## What The App Does

- Stores staff profiles and staff logins.
- Lets admins create and edit shifts.
- Shows a Monday-to-Sunday weekly rota.
- Supports permanent rota patterns for 1 month, 3 months, 6 months, end of year, or custom dates.
- Supports one-off cover shifts for sickness, holidays, and emergency cover.
- Lets staff request time off.
- Lets admins approve or reject time off.
- Adjusts rota totals when approved time off affects a shift.
- Shows tasks on dated rota days unless the task is done.
- Sends rota change notifications and shift reminders.
- Supports WhatsApp sharing and calendar sync.
- Includes optional UK rota planning warnings.
- Supports SQLite locally and Supabase/Postgres in production.

## Who Can Use It

Good fit:

- Fuel stations
- Convenience stores
- Newsagents
- Cafes and restaurants
- Takeaways
- Salons and barbers
- Cleaning teams
- Security teams
- Small warehouses
- Local delivery teams
- Small retail shops

Not a complete fit without extra work:

- Large HR/payroll departments
- Complex union rules
- Enterprise payroll integrations
- Businesses needing live GPS tracking
- Businesses needing legal or HR compliance automation

## User Roles

Admin users can:

- Manage staff
- Manage logins
- Create and edit shifts
- Generate rota patterns
- Approve time off
- Manage business settings
- View audit logs
- Configure UK rota warning options

Staff users can:

- View their own shifts
- Request time off
- View relevant reminders and notifications
- Enable phone/browser push notifications
- Use calendar sync
- Change their password

## Main Workflows

### First Setup

1. Deploy or run the app.
2. Log in as admin.
3. Change the temporary admin password.
4. Open Settings.
5. Set business name, logo, opening hours, and timezone.
6. Add staff.
7. Create staff logins or use the auto-created staff logins.
8. Create the first rota manually or with Rota Pattern.
9. Ask staff to log in and change their temporary passwords.

### Add Staff

1. Open Staff.
2. Press Add Staff.
3. Enter name, phone, email, and role.
4. Save.
5. The app creates a staff login automatically.
6. Give the staff member their temporary login details.

Temporary staff password:

```text
staff123
```

Staff must change the password before normal use.

### Create A Weekly Rota

1. Open Rota.
2. Press Add Shift.
3. Choose staff.
4. Choose date, start time, end time, break, reminder time, and notes.
5. Save.
6. The shift appears in the weekly rota and reminders.

### Use Rota Pattern

Use Rota Pattern when the same rota repeats for several weeks.

1. Open Rota Pattern.
2. Choose the Monday start date.
3. Add the weekly rota rows.
4. Choose how long the pattern should run:
   - 1 month
   - 3 months
   - 6 months
   - End of year
   - Custom end date
5. Generate rota.

Use "replace generated pattern shifts" when changing the permanent rota. One-off cover shifts are kept separate.

### Use Rota AI

Rota AI is a free text parser. It does not call paid AI services.

Best input format:

```text
Monday Afridi 6pm-10pm Shopping
Tuesday VITHTHI 5.30am-10pm
Wednesday Veera 1pm-10pm Cleaning
```

Workflow:

1. Open Rota AI.
2. Paste rota text.
3. Press Generate from text.
4. Review detected rows.
5. Send to Rota Pattern.
6. Generate the rota.

Image upload is currently a reference only. The free mode does not read image text automatically.

### Add One-off Cover

Use One-off Shift for temporary cover.

Examples:

- Staff sickness
- Approved holiday cover
- Busy weekend cover
- Emergency opening cover

One-off shifts are not deleted when replacing generated rota pattern shifts.

### Time Off

Staff workflow:

1. Open Time Off.
2. Choose start and end date.
3. Add a reason.
4. Submit.

Admin workflow:

1. Open Time Off.
2. Review the request.
3. Approve or reject.

Approved time off affects rota totals and appears in rota notes. Invalid date ranges are highlighted.

### Tasks

Tasks are for operational jobs. Rota notes are for shift-specific notes.

Task statuses:

```text
Backlog
Todo
Process
Done
```

Done tasks are hidden from the rota calendar.

### Notifications

Notifications are used for:

- Shift reminders
- Shift start reminders
- Shift changes
- Notes added or changed
- Time-off approvals and rejections
- Task updates where relevant

Staff only see their own relevant notifications.

### Phone Push Notifications

Push notifications are free but require HTTPS.

Staff setup:

1. Log in on the phone.
2. Open Account.
3. Enable notifications.
4. Allow browser/phone notification permission.
5. Confirm the test notification.

iPhone note:

Install the app to the home screen first, then open it from the home screen before enabling notifications.

Sound limitation:

Browsers and phones control notification sounds. A guaranteed custom alarm sound is not reliable when the browser is closed.

### Calendar Sync

Staff can sync shifts with:

- Google Calendar
- Apple Calendar
- Outlook
- Phone calendar apps

Each staff member has a private calendar feed. Keep the feed URL private because calendar apps access it without normal login cookies.

### Print And PDF

Use Print/PDF from Weekly Rota.

Recommended:

- Landscape for noticeboard print.
- Save as PDF for WhatsApp sharing.
- Check preview before printing.

## Dashboard

The dashboard is designed for daily admin use.

It shows:

- Greeting and date
- Today’s Action Plan
- Quick actions
- This Week summary
- Weekly day cards
- Optional warning alerts

Today’s Action Plan includes:

- Working now
- Next shift
- Tasks due today
- Needs attention

If no warning rules are enabled or no issues are found, it shows:

```text
All good today
```

## UK Rota Rules

Open Settings, then UK Rota Rules.

These checks are optional planning warnings only. They do not replace legal, HR, payroll, tax, or employment advice.

Rules:

- Break warning
- Daily rest warning
- Weekly hours warning
- Minimum wage warning
- Clock In / Out
- Location Check
- Estimated Wage Cost
- Show wage cost on dashboard

If a checkbox is off, that rule should not affect dashboard warnings.

Break warning:

- Warns when a shift is over the configured threshold and the break is too short.
- Default threshold: 6 hours.
- Default minimum break: 20 minutes.

Daily rest warning:

- Warns when the gap between two shifts is below the configured rest hours.
- Default: 11 hours.

Weekly hours warning:

- Optional.
- Warns when a staff member’s weekly paid hours are above the configured threshold.
- Default threshold: 48 hours.

Minimum wage warning:

- Optional.
- Helps prepare for wage planning.
- Admin should check current rates on GOV.UK.

Clock In / Out:

- Optional future operational feature.

Location Check:

- Disabled unless Clock In / Out is enabled.
- Location is only checked when staff clock in or out.
- The app does not track staff continuously.

Estimated Wage Cost:

- Optional planning feature.
- Does not replace payroll.

Disclaimer shown in the app:

```text
LocalOps Planner provides rota, reminder, task and estimated wage planning tools only. It does not replace legal, HR, payroll, tax or employment advice. Employers remain responsible for following UK employment law and payroll rules.
```

## Business Settings

Admins can change:

- Business name
- Logo
- Opening hours
- Timezone
- UK rota rules
- Login access

Recommended UK timezone:

```text
Europe/London
```

## Local Development

Install:

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
API list: http://localhost:5000/api
```

Run checks:

```bash
npm run build
npm run smoke
```

## Environment Variables

Backend:

```text
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url
DB_PATH=/data/fuelops.sqlite
DATABASE_URL=postgresql://...
ADMIN_RESET_TOKEN=temporary-secret-for-admin-recovery
VAPID_PUBLIC_KEY=optional-fixed-web-push-public-key
VAPID_PRIVATE_KEY=optional-fixed-web-push-private-key
VAPID_SUBJECT=mailto:admin@example.com
```

Frontend:

```text
VITE_API_BASE=https://your-backend-url
```

Important:

- Do not commit real database URLs.
- Use either `DATABASE_URL` or `DB_PATH`.
- Prefer `DATABASE_URL` with Supabase/Postgres for production.
- Use `ADMIN_RESET_TOKEN` only temporarily.
- The app uses server-side sessions, not JWT.

## Database

SQLite mode:

- Good for local development.
- Good for simple one-business installs.
- Needs persistent volume in production.

Postgres/Supabase mode:

- Recommended for production.
- Better backups.
- Better future SaaS path.
- Works by setting `DATABASE_URL`.

Tables created by the app include:

- `staff`
- `users`
- `sessions`
- `shifts`
- `settings`
- `notifications`
- `pushSubscriptions`
- `timeOffRequests`
- `availability`
- `tasks`
- `auditLog`

Supabase RLS warning:

The app connects through the backend using a database connection string. Do not expose the database password to the frontend. If Supabase shows "RLS disabled" warnings, that is mainly relevant to direct public client access. For this app, the browser should use only the Express API.

## Deployment

Recommended simple production setup:

1. Supabase for Postgres database.
2. Railway for backend.
3. Railway, Netlify, or Vercel for frontend.

Railway backend:

```text
Build: npm install
Start: npm start
Variables:
  NODE_ENV=production
  DATABASE_URL=your Supabase connection string
  FRONTEND_URL=https://your-frontend-url
```

Railway frontend:

```text
Build: npm --workspace frontend run build
Start: npm --workspace frontend run start
Variables:
  VITE_API_BASE=https://your-backend-url
```

If using SQLite on Railway:

```text
Mount path: /data
DB_PATH=/data/fuelops.sqlite
```

## Other Hosting Options

| Platform | Use For | Notes |
| --- | --- | --- |
| Railway | Frontend and backend | Easiest full-stack deployment. |
| Render | Backend or full-stack | Use Supabase/Postgres for database. |
| Fly.io | Backend | Good with volumes and CLI workflow. |
| DigitalOcean App Platform | Backend/frontend | Best with Supabase/Postgres. |
| AWS Lightsail | Backend/database | More manual server management. |
| Netlify | Frontend only | Backend still needed elsewhere. |
| Vercel | Frontend only | Backend/database should be separate. |
| Cloudflare Pages | Frontend only | Keep Express API elsewhere. |

## API Summary

Status:

- `GET /`
- `GET /health`
- `GET /api`
- `GET /api/health`

Auth:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/recover-admin`

Staff and users:

- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `POST /api/users/:id/reset-password`

Rota:

- `GET /api/shifts/week?startDate=yyyy-mm-dd`
- `GET /api/shifts/my`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `POST /api/shifts/copy-week`
- `POST /api/rota-patterns/generate`

Time off and availability:

- `GET /api/time-off`
- `POST /api/time-off`
- `PUT /api/time-off/:id`
- `GET /api/availability`
- `POST /api/availability`
- `DELETE /api/availability/:id`

Tasks:

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Notifications and push:

- `GET /api/reminders/upcoming`
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `GET /api/push/public-key`
- `GET /api/push/status`
- `POST /api/push/subscribe`
- `POST /api/push/test`

Settings:

- `GET /api/settings/branding`
- `PUT /api/settings/branding`
- `GET /api/settings/opening-hours`
- `PUT /api/settings/opening-hours`
- `GET /api/settings/uk-rules`
- `PUT /api/settings/uk-rules`

Calendar:

- `GET /api/calendar/my-feed`
- `GET /calendar/:token.ics`

Audit:

- `GET /api/audit`

## Security

Implemented:

- HTTP-only cookies.
- Secure cookies in production.
- Login rate limiting.
- Forced first password change.
- Password reset forces password change.
- Admin-only server routes.
- Staff users are filtered to their own data where required.

Do before real use:

- Change admin password.
- Remove or disable unused default accounts.
- Use HTTPS.
- Use strong database passwords.
- Keep `DATABASE_URL` secret.
- Remove `ADMIN_RESET_TOKEN` after recovery.
- Back up the database.

## Forgotten Admin Password

1. Add this backend environment variable temporarily:

```text
ADMIN_RESET_TOKEN=make-a-long-random-secret
```

2. Redeploy backend.

3. Run:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://your-backend-url/api/auth/recover-admin" `
  -ContentType "application/json" `
  -Body '{"token":"make-a-long-random-secret","username":"admin","newPassword":"NewPassword123"}'
```

4. Log in.
5. Change password.
6. Remove `ADMIN_RESET_TOKEN`.
7. Redeploy backend again.

## Testing Checklist

Before giving the app to staff:

- Login as admin.
- Change admin password.
- Add one test staff member.
- Login as staff.
- Change staff password.
- Add a shift.
- Confirm shift appears on dashboard and rota.
- Edit shift notes.
- Confirm staff receives notification.
- Submit time off.
- Approve time off.
- Confirm rota totals adjust.
- Enable phone notifications.
- Send test notification.
- Add calendar feed to phone calendar.
- Print weekly rota.
- Run smoke test.

## Troubleshooting

Backend root shows JSON:

- This is normal for the backend URL.
- Use the frontend URL to open the app.

Frontend cannot log in:

- Check `VITE_API_BASE`.
- Check backend `FRONTEND_URL`.
- Check browser cookies are allowed.
- Check both URLs use HTTPS in production.

Railway says no changes to watched files:

- Frontend watch path: `/frontend/**`
- Backend watch path: `/backend/**`
- Single-service watch path: `/**`

Rota rules reset after refresh:

- Confirm backend is redeployed.
- Confirm `PUT /api/settings/uk-rules` succeeds.
- Confirm the database is persistent.
- Refresh with Ctrl+F5 after deployment.

Dashboard warnings still show after disabling rules:

- Save UK Rota Rules.
- Refresh dashboard.
- Only enabled warning rules should affect dashboard warnings.

Data disappears after deploy:

- SQLite database is not on persistent storage.
- Use Supabase/Postgres or Railway volume with `DB_PATH=/data/fuelops.sqlite`.

Supabase connection causes 502:

- Check `DATABASE_URL`.
- Use the correct Supabase pooled/direct connection string for your network.
- Ensure SSL is supported by the connection.
- Check Railway deploy logs.

Push notifications do not arrive:

- App must be on HTTPS.
- Staff must allow notifications.
- iPhone users should install the PWA first.
- Phone battery settings can delay notifications.

Calendar feed not updating:

- Calendar apps cache feeds.
- Wait for the phone/calendar refresh interval.
- Re-add the feed if needed.

## Production Handover Notes

Give the business owner:

- Frontend URL
- Admin username
- Temporary admin password
- Instruction to change password immediately
- Staff onboarding instructions
- Backup responsibility
- Note that the app is not legal/payroll advice

Keep private:

- Supabase password
- `DATABASE_URL`
- `ADMIN_RESET_TOKEN`
- Calendar feed tokens
- Railway account access

