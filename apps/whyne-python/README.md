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
│   ├── booking_service.py
│   ├── granton_client.py
│   └── payment_client.py
├── models/
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

Default DB: shared PostgreSQL (`studioos`).

To use PostgreSQL, set:

```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/studioos"
export GRANTON_BASE_URL="http://127.0.0.1:3000"
export SHAN_BASE_URL="http://127.0.0.1:5000"
export GRANTON_SERVICE_SECRET="shared-internal-secret" # optional
export WHYNE_WEBHOOK_SECRET="shared-payment-secret"   # optional
```

Run DB migration (required after this integration refactor):

```bash
export FLASK_APP=app.main:create_app
python -m flask db upgrade -d migrations
```

## Example cURL Requests

Create booking:

```bash
curl -X POST http://127.0.0.1:5000/bookings \
	-H "Content-Type: application/json" \
	-H "x-user-id: 1" \
	-H "x-user-role: ARTIST" \
	-d '{
		"artist_id": 1,
		"producer_id": 2,
		"studio_id": "uuid-from-granton-studio",
		"project_title": "Single Tracking Session",
		"session_date": "2026-03-15",
		"start_time": "10:00:00",
		"end_time": "12:00:00"
	}'
```

Request payment (calls `shan-python`):

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/request-payment \
	-H "Content-Type: application/json" \
	-H "x-user-id: 1" \
	-H "x-user-role: ARTIST" \
	-d '{
		"phone": "2547XXXXXXXX",
		"amount": 5000
	}'
```

Approve booking:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/approve \
	-H "Content-Type: application/json" \
	-H "x-user-id: 2" \
	-H "x-user-role: PRODUCER" \
	-d '{"producer_id": 2}'
```

Start recording:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/start-recording \
	-H "x-user-id: 2" \
	-H "x-user-role: PRODUCER"
```

Start mixing:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/start-mixing \
	-H "x-user-id: 2" \
	-H "x-user-role: PRODUCER"
```

Mark ready:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/mark-ready \
	-H "x-user-id: 2" \
	-H "x-user-role: PRODUCER"
```

Deliver:

```bash
curl -X POST http://127.0.0.1:5000/bookings/1/deliver \
	-H "x-user-id: 1" \
	-H "x-user-role: ARTIST"
```

Payment sync webhook (typically called by `shan-python`):

```bash
curl -X POST http://127.0.0.1:5000/bookings/payment-webhook \
	-H "Content-Type: application/json" \
	-H "x-webhook-secret: shared-payment-secret" \
	-d '{
		"bookingRef": "BKG-ABC123DEF456",
		"isFullPayment": true,
		"paymentRef": "MPE123XYZ"
	}'
```

Calendar view:

```bash
curl "http://127.0.0.1:5000/calendar?producer_id=2&month=2026-03" \
	-H "x-user-id: 2" \
	-H "x-user-role: PRODUCER"
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

- AI delay prediction based on historical mixing durations
- Producer workload analytics
- Revenue per time-slot tracking
