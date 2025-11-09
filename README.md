# Event Booking Web Application

An end-to-end event booking platform featuring an Angular (v17) frontend with Angular Material and a FastAPI backend backed by SQLite. Users can manage their preferences, browse weekly event calendars, subscribe or unsubscribe from slots, while administrators can author new timeslots and monitor bookings.

## Features

- **User preferences** – Capture visitor details and select favourite event categories.
- **Weekly calendar view** – Filtered to the user's preferred categories with week navigation, real-time availability, and sign-up/cancel actions.
- **Admin controls** – Create new timeslots, filter by category, and review booking ownership at a glance.
- **Single booking rule** – Each timeslot accepts one attendee; reservations are transparent to other users.
- **SQLite persistence** – FastAPI automatically seeds default categories (`Cat 1`, `Cat 2`, `Cat 3`) on first run.

## Tech Stack

- **Frontend:** Angular 17, Angular Material, RxJS, SCSS
- **Backend:** FastAPI, SQLAlchemy 2.0, SQLite
- **Tooling:** Node.js (npm), Python 3.11+, Uvicorn

## Repository Layout

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   └── requirements.txt
├── event-booking-frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.{ts,html,scss}
│   │   │   ├── core/...
│   │   │   └── pages/{calendar,preferences,admin}/...
│   └── package.json
└── README.md
```

## Prerequisites

- **Node.js** ≥ 18.17 (ships with npm)
- **Python** ≥ 3.11

Verify versions:

```bash
node -v
npm -v
python3 --version
```

## Backend Setup (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # For Windows use: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be served at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

> The SQLite database (`event_booking.db`) is created automatically in the repository root. Default event categories are seeded on first start.

### Useful API calls

```bash
# List categories
curl http://localhost:8000/categories

# Retrieve timeslots for a week
curl "http://localhost:8000/timeslots?start_date=2025-01-06&end_date=2025-01-12"
```

## Frontend Setup (Angular)

```bash
cd event-booking-frontend
npm install
npm start
# or: ng serve --open
```

The development server runs on `http://localhost:4200` and proxies API calls directly to `http://localhost:8000` (CORS is enabled on the backend).

### Frontend credentials

The app is open – there is no authentication. A user must configure their **display name** and **email** in Preferences before booking a slot.

## Running the Full Stack

1. Start the FastAPI backend (`uvicorn app.main:app --reload --port 8000`).
2. Start the Angular frontend (`npm start` from `event-booking-frontend`).
3. Visit `http://localhost:4200` in your browser.

## Testing the Booking Flow

1. Go to **Preferences** and enter a display name, email, and choose at least one category.
2. Navigate to **Calendar**, pick a week, and sign up for an available slot.
3. Use **Cancel booking** to release the slot.
4. Switch to **Admin** to create additional timeslots and view booking details.

## Troubleshooting

- **CORS errors:** Ensure the backend is running on port `8000`. Restart both servers if origins were changed.
- **Database locked/session errors:** Stop the backend server and remove `event_booking.db` (or delete the conflicting process) before restarting.
- **Angular build issues:** Clear caches with `rm -rf node_modules/` and reinstall dependencies.

## Future Enhancements

- User authentication and attendee history.
- Email notifications for bookings/cancellations.
- Admin tools for editing or deleting existing timeslots.
- Automated tests for frontend services and backend routes.

---

Happy scheduling! 🎉
