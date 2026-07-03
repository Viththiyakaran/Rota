# FuelOps Rota Admin Guide

This guide is for business owners, managers, and rota administrators.

## Admin Login

Default first login:

```text
username: admin
password: admin123
```

The app forces a password change before normal use. Change this password before using the system with real staff.

## Dashboard

The Dashboard is the main admin workspace.

Use it to open:

- Rota AI
- Rota Pattern
- One-off Shift
- Weekly Rota
- Tasks
- Settings

The bottom navigation is kept smaller for everyday use.

## Staff Management

Open Staff to:

- Add staff
- Edit staff name, phone, email, and role
- Deactivate staff
- Review active staff

When a staff member is added, the system creates a login automatically.

Default staff password:

```text
staff123
```

Staff are forced to change this password after first login.

## User Management

Open Settings to manage logins.

Admin can:

- Create admin or staff logins
- Link a staff login to a staff profile
- Reset passwords
- Disable logins

Use admin accounts only for trusted managers.

## Business Settings

Open Settings to configure:

- Business name
- Logo image
- Opening hours
- Timezone

Default timezone:

```text
Europe/London
```

The app is designed for UK businesses and Monday-to-Sunday rota weeks.

## Rota AI

Rota AI is a free helper for converting typed rota text into pattern rows.

Example input:

```text
Monday VITHTHI 5.30am-7pm Shopping
Monday Afridi 6pm-10pm Shopping
Tuesday VITHTHI 5.30am-10pm
Wednesday Veera 1pm-10pm Cleaning
```

Workflow:

1. Press Rota AI.
2. Paste/type rota text.
3. Upload an image only as a reference if needed.
4. Press Generate from text.
5. Review detected rows.
6. Press Send to Pattern.
7. Generate the rota from Rota Pattern.

Notes:

- Rota AI does not use paid AI services.
- It does not automatically read image text yet.
- For image OCR, add a local OCR library or external OCR service later.

## Rota Pattern

Use Rota Pattern for normal repeating rotas.

Workflow:

1. Choose the first Monday.
2. Add the weekly shifts manually, import the current week, or send rows from Rota AI.
3. Choose duration:
   - 1 month
   - 3 months
   - 6 months
   - End of year
   - Custom
4. Keep "Replace existing generated pattern shifts" enabled when changing a generated rota.
5. Press Generate rota.

Important:

- Generated pattern shifts are marked internally.
- Replacing generated pattern shifts does not delete one-off cover shifts.
- One-off Shift should be used only for temporary changes.

## One-off Shift

Use One-off Shift for:

- Holiday cover
- Sickness cover
- Emergency cover
- One-day rota changes

The staff member receives a notification when a shift is assigned or changed.

## Time Off

Workflow:

1. Staff submits a time-off request.
2. Admin reviews it from Time Off.
3. Admin approves or rejects.
4. Approved time off removes affected shifts from rota totals.
5. Rota notes show who has time off.

## Tasks

Tasks are for shop jobs that are not rota notes.

Statuses:

- Backlog
- Todo
- Process
- Done

Dated tasks show on the rota day. Done tasks are hidden from the rota.

## Print Or PDF

Open Weekly Rota and press Print / PDF.

Recommended:

- Use landscape for noticeboard print.
- Use Save as PDF for WhatsApp sharing.

## Calendar And Reminders

Staff can:

- Add a shift to Google Calendar.
- Download a phone calendar `.ics` file.
- Subscribe to their private calendar feed.
- Enable phone/browser push notifications.

Push reminders are sent before shifts and at shift start when staff enable notifications.

