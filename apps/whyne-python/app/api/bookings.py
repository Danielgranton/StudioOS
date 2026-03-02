from __future__ import annotations

import calendar
from datetime import datetime

from flask import Blueprint, jsonify, request

from app.models import BookingStatus
from app.services import booking_service

bookings_bp = Blueprint("bookings", __name__)


def _error(message: str, status_code: int):
    return jsonify({"success": False, "error": message}), status_code


def _parse_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_time(value: str):
    return datetime.strptime(value, "%H:%M:%S").time()


def _parse_month(month_value: str):
    return datetime.strptime(month_value, "%Y-%m").date()


@bookings_bp.post("/bookings")
def create_booking():
    payload = request.get_json(silent=True) or {}

    required = ["artist_id", "producer_id", "session_date", "start_time", "end_time"]
    missing = [field for field in required if field not in payload]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}", 400)

    try:
        booking = booking_service.create_pending_booking(
            artist_id=int(payload["artist_id"]),
            producer_id=int(payload["producer_id"]),
            session_date=_parse_date(payload["session_date"]),
            start_time=_parse_time(payload["start_time"]),
            end_time=_parse_time(payload["end_time"]),
        )
    except ValueError as exc:
        return _error(str(exc), 400)
    except LookupError as exc:
        return _error(str(exc), 404)
    except Exception:
        return _error("Failed to create booking", 500)

    return jsonify({"success": True, "data": booking.to_dict()}), 201


@bookings_bp.post("/bookings/<int:booking_id>/approve")
def approve_booking(booking_id: int):
    payload = request.get_json(silent=True) or {}
    if "producer_id" not in payload:
        return _error("producer_id is required", 400)

    booking = booking_service.get_booking_or_none(booking_id)
    if not booking:
        return _error("Booking not found", 404)

    try:
        updated = booking_service.approve_booking(booking, int(payload["producer_id"]))
    except PermissionError as exc:
        return _error(str(exc), 403)
    except ValueError as exc:
        return _error(str(exc), 400)

    return jsonify({"success": True, "data": updated.to_dict()})


def _transition_route(booking_id: int, target_status: BookingStatus):
    booking = booking_service.get_booking_or_none(booking_id)
    if not booking:
        return _error("Booking not found", 404)

    try:
        updated = booking_service.transition_booking(booking, target_status)
    except ValueError as exc:
        return _error(str(exc), 400)

    return jsonify({"success": True, "data": updated.to_dict()})


@bookings_bp.post("/bookings/<int:booking_id>/start-recording")
def start_recording(booking_id: int):
    return _transition_route(booking_id, BookingStatus.RECORDING)


@bookings_bp.post("/bookings/<int:booking_id>/start-mixing")
def start_mixing(booking_id: int):
    return _transition_route(booking_id, BookingStatus.MIXING)


@bookings_bp.post("/bookings/<int:booking_id>/mark-ready")
def mark_ready(booking_id: int):
    return _transition_route(booking_id, BookingStatus.READY)


@bookings_bp.post("/bookings/<int:booking_id>/deliver")
def deliver(booking_id: int):
    return _transition_route(booking_id, BookingStatus.DELIVERED)


@bookings_bp.get("/calendar")
def calendar_view():
    producer_id = request.args.get("producer_id")
    month_value = request.args.get("month")

    if not producer_id or not month_value:
        return _error("producer_id and month are required", 400)

    try:
        producer_id = int(producer_id)
        month_start = _parse_month(month_value).replace(day=1)
    except ValueError:
        return _error("Invalid producer_id or month format. Use month=YYYY-MM", 400)

    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    month_end = month_start.replace(day=last_day)

    bookings = booking_service.find_calendar_bookings(producer_id, month_start, month_end)
    now = datetime.utcnow()

    grouped = {}
    for booking in bookings:
        booking_data = booking.to_dict()
        if booking.status == BookingStatus.MIXING and booking.expected_ready_at:
            seconds_remaining = int((booking.expected_ready_at - now).total_seconds())
            booking_data["countdown_seconds"] = max(seconds_remaining, 0)

        grouped.setdefault(booking.session_date.isoformat(), []).append(booking_data)

    return jsonify(
        {
            "success": True,
            "data": {
                "producer_id": producer_id,
                "month": month_start.strftime("%Y-%m"),
                "bookings_by_date": grouped,
            },
        }
    )
