# LocalOps Planner Security And Operations

This document covers production security and operational checks.

## Login Security

Implemented:

- HTTP-only session cookies
- Secure cookies in production
- Login rate limiting
- Forced first password change
- Password reset forces password change
- Admin-only backend route protection
- Staff-only data filtering where needed

## Password Rules

Current minimum:

```text
6 characters
```

Recommended real-world policy:

- Use at least 10 characters.
- Do not share accounts.
- Disable staff logins when staff leave.
- Reset temporary passwords quickly.

## Default Credentials

Default credentials exist only for initial setup.

Change immediately:

```text
admin / admin123
staff users / staff123
```

## Admin Recovery

Admin recovery is disabled unless this variable exists:

```text
ADMIN_RESET_TOKEN
```

Use it temporarily only.

After recovery:

1. Log in.
2. Change password.
3. Remove `ADMIN_RESET_TOKEN`.
4. Redeploy.

## Sessions

Sessions are stored in the configured database.

If the database is deleted, users must log in again and app data may be lost.

## Database Operations

For production, prefer Supabase/Postgres and set:

```text
DATABASE_URL=your Supabase connection string
```

For SQLite-only deployments, store the database on persistent disk:

```text
/data/fuelops.sqlite
```

Do not store production data only in the Railway temporary filesystem.
Never commit database URLs, passwords, or Supabase keys into Git.

## Backups

Back up either the Supabase/Postgres database or the SQLite file:

```text
/data/fuelops.sqlite
```

Suggested schedule:

- Daily for active businesses
- Before app upgrades
- Before database migrations
- Before moving host

## Push Notifications

Push notifications require HTTPS.

Staff must enable notifications on each device.

For iPhone:

1. Install the PWA to the home screen.
2. Open from home screen.
3. Enable notifications in Account.

Limitations:

- Browser/phone controls notification sound.
- Custom alarm sound is not reliable when browser is closed.
- Staff must not block notifications in phone/browser settings.

## Calendar Feed Security

Calendar feed links are private tokens.

Treat them like passwords because calendar apps fetch them without the normal app login cookie.

If a feed link is shared by mistake, regenerate the staff calendar token in a future admin tool or manually update the database.

## Railway Operational Checklist

Check after deployment:

- Backend service online
- Frontend service online
- `/health` returns `ok`
- `/api` lists routes
- Login works
- Rota loads
- Staff can see their own shifts
- Time-off approval affects rota totals
- Push notification test works on HTTPS

## Common Problems

### 502 Application failed to respond

Check:

- Node version is 22.5+
- Start command is correct
- SQLite path is writable
- Volume is mounted
- Deploy logs show no startup errors

### Login works locally but not in production

Check:

- `VITE_API_BASE`
- `FRONTEND_URL`
- HTTPS URLs
- Browser cookies are allowed
- Backend CORS includes frontend URL

### Data disappears after deployment

Likely cause:

```text
DB_PATH is not using persistent storage
```

Fix:

```text
DB_PATH=/data/fuelops.sqlite
```

and mount a Railway volume at `/data`.
