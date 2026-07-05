# LocalOps Planner API Reference

Base URL:

```text
http://localhost:5000
```

Production:

```text
https://your-backend-url
```

## Status Routes

### GET /

Returns backend status JSON or serves the frontend build if available and requested by browser.

### GET /health

Returns:

```json
{
  "status": "ok",
  "uptime": 123,
  "timestamp": "2026-07-03T10:00:00.000Z",
  "environment": "production"
}
```

### GET /api

Returns available API route list.

### GET /api/health

Returns app health and version metadata.

## Auth

### POST /api/auth/login

Body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

### GET /api/auth/me

Returns current logged-in user.

### POST /api/auth/logout

Clears the session cookie.

### POST /api/auth/change-password

Body:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### POST /api/auth/recover-admin

Requires `ADMIN_RESET_TOKEN`.

Body:

```json
{
  "token": "secret-token",
  "username": "admin",
  "newPassword": "NewPassword123"
}
```

## Staff

- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`

Staff fields:

```json
{
  "name": "Afridi",
  "phone": "07123 456781",
  "email": "afridi@example.local",
  "role": "Fuel Attendant",
  "active": true
}
```

## Users

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `POST /api/users/:id/reset-password`

Admin only.

## Shifts

- `GET /api/shifts/week?startDate=yyyy-mm-dd`
- `GET /api/shifts/my`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `POST /api/shifts/copy-week`

Shift body:

```json
{
  "staffId": 1,
  "shiftDate": "2026-07-06",
  "startTime": "05:30",
  "endTime": "14:00",
  "breakMinutes": 0,
  "reminderMinutes": 30,
  "notes": "Shopping",
  "isExtra": false,
  "coverForStaffId": null
}
```

## Rota Pattern

### POST /api/rota-patterns/generate

Admin only.

Body:

```json
{
  "startDate": "2026-07-06",
  "endMode": "3m",
  "customEndDate": "",
  "replaceGenerated": true,
  "entries": [
    {
      "staffId": 1,
      "dayOffset": 0,
      "startTime": "05:30",
      "endTime": "19:00",
      "breakMinutes": 0,
      "reminderMinutes": 30,
      "notes": "Shopping"
    }
  ]
}
```

`dayOffset` values:

```text
0 Monday
1 Tuesday
2 Wednesday
3 Thursday
4 Friday
5 Saturday
6 Sunday
```

`endMode` values:

```text
1m
3m
6m
year
custom
```

## Reminders And Notifications

- `GET /api/reminders/upcoming`
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `GET /api/push/public-key`
- `GET /api/push/status`
- `POST /api/push/subscribe`
- `POST /api/push/test`

## Calendar

- `GET /api/calendar/my-feed`
- `GET /calendar/:token.ics`

## Time Off

- `GET /api/time-off`
- `POST /api/time-off`
- `PUT /api/time-off/:id`

Time-off body:

```json
{
  "startDate": "2026-07-10",
  "endDate": "2026-07-11",
  "reason": "Holiday"
}
```

Admin approval body:

```json
{
  "status": "approved"
}
```

## Availability

- `GET /api/availability`
- `POST /api/availability`
- `DELETE /api/availability/:id`

## Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Task statuses:

```text
backlog
todo
process
done
```

## Settings

- `GET /api/settings/branding`
- `PUT /api/settings/branding`
- `GET /api/settings/opening-hours`
- `PUT /api/settings/opening-hours`

## Audit

- `GET /api/audit`

Admin only.
