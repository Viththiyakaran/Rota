# FuelOps Rota

FuelOps Rota is a simple mobile-friendly rota planner for a UK fuel station.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite
- Styling: Tailwind CSS
- Services: No paid services

## Features

- Staff management with add, edit and deactivate actions
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
http://localhost:4000
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

- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `GET /api/shifts/week?startDate=yyyy-mm-dd`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`
- `GET /api/reminders/upcoming`

## Notes

The SQLite database file is created automatically at `backend/fuelops.sqlite`. If the database is empty, the backend seeds sample staff and shifts on startup.

Node 22.5 or newer is recommended because the backend uses Node's built-in SQLite support.
