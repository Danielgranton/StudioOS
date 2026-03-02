# Studio Session Booking System (Flask)

Calendar and session lifecycle backend for a studio operating system.

## Project Overview

This service handles:

- Session booking
- Time-slot conflict prevention
- Strict status lifecycle enforcement
- 7-day mixing timeline automation
- Automation hooks for reminders and future AI nudges

## Structure

```
app/
├── api/
│   └── bookings.py
├── services/
│   ├── availability.py
│   └── booking_service.py
├── models/
│   ├── user.py
│   └── booking.py
├── automation.py
└── main.py

tests/
├── conftest.py
├── test_booking_flow.py
└── test_availability.py
```

## Booking Lifecycle (text diagram)

```
PENDING
	├──> APPROVED ───> RECORDING ───> MIXING ───> READY ───> DELIVERED
	└──> CANCELLED

APPROVED   └──> CANCELLED
RECORDING  └──> CANCELLED
MIXING     └──> CANCELLED
```

Only these transitions are allowed.

## Setup

1. Activate virtual environment

```bash
source /home/shannel/StudioOS/studio/bin/activate
```

2. Install dependencies

```bash
cd /home/shannel/StudioOS/apps/whyne-python
pip install -r requirements.txt
```

3. Run app

```bash
python -m app.main
```

4. Seed sample users (optional, for quick testing)

```bash
python -m app.seed
```

Default DB: SQLite (`booking_dev.db`)

To use PostgreSQL, set:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/studio_booking"
```

## Example cURL Requests

Create booking:

```bash
curl -X POST http://127.0.0.1:5000/bookings \
	-H "Content-Type: application/json" \
	-d '{
		"artist_id": 1,
		"producer_id": 2,
		"session_date": "2026-03-15",
		"start_time": "10:00:00",
		"end_time": "12:00:00"
	}'
```

Approve booking:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/approve \
	-H "Content-Type: application/json" \
	-d '{"producer_id": 2}'
```

Start recording:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/start-recording
```

Start mixing:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/start-mixing
```

Mark ready:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/mark-ready
```

Deliver:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/deliver
```

Calendar view:

```bash
curl "http://127.0.0.1:5000/calendar?producer_id=2&month=2026-03"
```

## Automation Logic

Two APScheduler daily jobs are configured:

1. Auto-ready transition job (00:05 UTC)
	 - Finds bookings where status is `MIXING` and `expected_ready_at <= now`
	 - Transitions booking to `READY`
	 - Sets `ready_at`
	 - Logs the event

2. Tomorrow reminder job (09:00 UTC)
	 - Finds bookings where status is `APPROVED` and `session_date == tomorrow`
	 - Prints reminder logs (placeholder for SMS/email integration)

## Architectural Rules Applied

- Status is never set directly in routes.
- Routes call service/model methods for transitions.
- Availability checks are centralized in `availability.py`.
- Arbitrary status assignment is blocked by transition map.
- Business logic is isolated from `main.py`.

## Running Tests

```bash
pytest
```

## Future Extensions (not implemented)

- Notification service module
- AI delay prediction based on historical mixing durations
- Producer workload analytics
- Revenue per time-slot tracking

