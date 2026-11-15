# Evently — Event Ticket Booking System

**Software Architecture and Design | Iteration 01 / Sprint 01**

A small working web application for booking **free event tickets**. It intentionally implements only three core modules from the Sprint 01 backlog.

## What is implemented

| Module | Sprint 01 features |
| --- | --- |
| Authentication | Customer registration, login, three user roles, protected API routes |
| Event Management | Browse events, view details, organizer creates and views events |
| Ticket Booking | Customer books one ticket, views/cancels bookings, admin views all bookings |

**User stories:** US01–US10 from the agreed Sprint 01 backlog.

Not implemented: payments, seat selection, QR codes, email notifications, event editing, search/filtering, or analytics beyond small dashboard counts.

## Technologies

- **Frontend:** React 18, React Router, Vite, plain CSS, Lucide icons
- **Backend:** Node.js, Express, JWT authentication
- **Database:** SQLite using Node.js built-in `node:sqlite` (no separate DB server needed)

**Requirement:** Node.js **22.13 or newer** and npm. Check with `node -v`.

## Run on your computer

Download/extract the ZIP, open the `evently-sprint-01` folder, and start **two terminals**.

**Terminal 1 — Backend:**

```bash
cd backend
npm install
npm run dev
```

Backend starts at **http://localhost:4000**. The SQLite database, tables, demo users, and six future example events are created automatically when the backend starts.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Vite automatically proxies requests from `/api` to the backend on port 4000.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@evently.demo` | `Demo123!` |
| Organizer | `organizer@evently.demo` | `Demo123!` |
| Admin | `admin@evently.demo` | `Demo123!` |

You can also register a new **Customer** account. Only Customer registrations are public. Organizer/Admin accounts are seeded for the course demo.

**Important:** These are intentionally public **demo credentials**. Do not use this project or its default JWT secret for a real deployed service.

## Manual demonstration (5 minutes)

1. Log in as **Organizer**. Open My Events, then create a new event with a future date and capacity of 2.
2. Log out and log in as **Customer**. Open that event from Explore Events and click **Book Free Ticket**.
3. Open My Bookings. Confirm the new reservation appears and that its status is **Confirmed**.
4. Return to the same event and attempt another booking. The server must reject duplicate active reservations.
5. Open My Bookings, cancel the ticket, and verify its status becomes **Cancelled**.
6. Revisit the event: its available ticket count should have increased again.
7. Log out and log in as **Admin**. All Bookings should show the reservation and its **Cancelled** status.
8. Test validation: as Organizer, submit an empty event title, a past date, or capacity 0. Form errors should appear.

For a **fully booked** screenshot, create an event with capacity 1, book it as Customer, and view the event again; its booking button will be disabled.

## Database structure

`users (id, full_name, email, password_hash, role, created_at)`

`events (id, organizer_id, title, description, starts_at, location, capacity, created_at)`

`bookings (id, customer_id, event_id, status, created_at)`

Ticket availability = event capacity minus **confirmed** bookings. The booking operation uses a SQLite `BEGIN IMMEDIATE` transaction to avoid overbooking. Authentication and role permissions are checked by the backend.

## Test

```bash
cd backend
npm test
```

This runs basic database and ticket availability tests using Node's built-in test runner. In addition, follow the manual demonstration steps above to test user journeys and APIs.

Build the frontend for production:

```bash
cd frontend
npm run build
```

## Project structure

```
evently-sprint-01/
├── backend/
│   ├── src/database.js       SQLite schema, data seeding
│   ├── src/server.js         REST API, authentication, booking logic
│   ├── tests/database.test.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/App.jsx           Pages, routing, API requests
│   ├── src/styles.css        Evently indigo/white styling
│   ├── src/main.jsx
│   ├── index.html
│   └── package.json
├── .gitignore
└── README.md
```

## Configuration (optional)

The backend reads environment variables from the terminal environment. Example values are in `backend/.env.example`. To use them, export them in your shell, or use Node.js's `--env-file` option when starting the backend. Example:

```bash
cd backend
cp .env.example .env
node --env-file=.env src/server.js
```

For any externally accessible deployment, replace the demo JWT secret with a long, random secret, disable/reset the demo accounts, and configure HTTPS plus appropriate security protections. This code is meant for local coursework.

## Reset demo data

Stop the backend, delete the **`backend/data/`** folder, and start the backend again. This resets accounts, bookings, and events to the seed data.

## Push to GitHub

Create an empty GitHub repo (for example `evently-sprint-01`) and, from the extracted project root, run:

```bash
git init
git add .
git commit -m "Sprint 01 working product"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/evently-sprint-01.git
git push -u origin main
```

`.gitignore` excludes installed dependencies, build outputs, environment secrets, and local SQLite files.

## Report evidence

Take screenshots of: Login, Registration, Browse Events, Event Details, My Bookings, Organizer Dashboard, Create Event, Admin Dashboard, Fully Booked state, and form validation. Also include your **Figma link**, **GitHub link**, a short **demo video**, actual **Trello board snapshots**, and a **burn-down chart** based on your team's real sprint progress.
