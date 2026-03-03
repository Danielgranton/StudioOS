from __future__ import annotations

import calendar
from datetime import datetime

import requests
from flask import Blueprint, current_app, jsonify, request

from app.models import BookingStatus
from app.services import booking_service

bookings_bp = Blueprint("bookings", __name__)


def _error(message: str, status_code: int):
    return jsonify({"success": False, "error": message}), status_code


def _get_actor(allowed_roles: set[str]):
    user_id_raw = request.headers.get("x-user-id")
    user_role = request.headers.get("x-user-role")
    if not user_id_raw or not user_role:
        return None, _error("Missing auth headers: x-user-id and x-user-role are required", 401)

    try:
        user_id = int(user_id_raw)
    except ValueError:
        return None, _error("Invalid x-user-id header", 400)

    if user_role not in allowed_roles:
        return None, _error("Action not allowed for this role", 403)

    return {"user_id": user_id, "role": user_role}, None


def _parse_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_time(value: str):
    return datetime.strptime(value, "%H:%M:%S").time()


def _parse_month(month_value: str):
    return datetime.strptime(month_value, "%Y-%m").date()


@bookings_bp.post("/bookings")
def create_booking():
    actor, auth_error = _get_actor({"ARTIST"})
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True) or {}

    required = [
        "artist_id",
        "producer_id",
        "studio_id",
        "project_title",
        "session_date",
        "start_time",
        "end_time",
    ]
    missing = [field for field in required if field not in payload]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}", 400)

    try:
        artist_id = int(payload["artist_id"])
        producer_id = int(payload["producer_id"])
        if artist_id != actor["user_id"]:
            return _error("artist_id must match authenticated artist", 403)

        booking = booking_service.create_pending_booking(
            artist_id=artist_id,
            producer_id=producer_id,
            studio_id=str(payload["studio_id"]),
            project_title=str(payload["project_title"]),
            session_date=_parse_date(payload["session_date"]),
            start_time=_parse_time(payload["start_time"]),
            end_time=_parse_time(payload["end_time"]),
        )
    except ValueError as exc:
        return _error(str(exc), 400)
    except LookupError as exc:
        return _error(str(exc), 404)
    except requests.RequestException:
        return _error("Failed to validate users from granton service", 502)
    except Exception:
        return _error("Failed to create booking", 500)

    return jsonify({"success": True, "data": booking.to_dict()}), 201


@bookings_bp.post("/bookings/<int:booking_id>/approve")
def approve_booking(booking_id: int):
    actor, auth_error = _get_actor({"PRODUCER"})
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True) or {}
    if "producer_id" not in payload:
        return _error("producer_id is required", 400)

    booking = booking_service.get_booking_or_none(booking_id)
    if not booking:
        return _error("Booking not found", 404)

    try:
        producer_id = int(payload["producer_id"])
        if producer_id != actor["user_id"]:
            return _error("producer_id must match authenticated producer", 403)

        updated = booking_service.approve_booking(booking, producer_id)
    except PermissionError as exc:
        return _error(str(exc), 403)
    except ValueError as exc:
        return _error(str(exc), 400)
    except requests.RequestException:
        return _error("Failed to create project in granton service", 502)

    return jsonify({"success": True, "data": updated.to_dict()})


def _transition_route(booking_id: int, target_status: BookingStatus):
    actor, auth_error = _get_actor({"PRODUCER", "ARTIST"})
    if auth_error:
        return auth_error

    booking = booking_service.get_booking_or_none(booking_id)
    if not booking:
        return _error("Booking not found", 404)

    # Producers can transition their bookings, artists can only deliver.
    if actor["role"] == "PRODUCER" and booking.producer_id != actor["user_id"]:
        return _error("Only assigned producer can perform this action", 403)
    if actor["role"] == "ARTIST":
        if target_status != BookingStatus.DELIVERED:
            return _error("Artists can only mark booking as delivered", 403)
        if booking.artist_id != actor["user_id"]:
            return _error("Only assigned artist can deliver this booking", 403)

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


@bookings_bp.post("/bookings/<int:booking_id>/request-payment")
def request_payment(booking_id: int):
    actor, auth_error = _get_actor({"PRODUCER", "ARTIST"})
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True) or {}
    missing = [field for field in ["phone", "amount"] if field not in payload]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}", 400)

    booking = booking_service.get_booking_or_none(booking_id)
    if not booking:
        return _error("Booking not found", 404)
    if actor["role"] == "PRODUCER" and booking.producer_id != actor["user_id"]:
        return _error("Only assigned producer can request payment", 403)
    if actor["role"] == "ARTIST" and booking.artist_id != actor["user_id"]:
        return _error("Only assigned artist can request payment", 403)

    try:
        payment_response = booking_service.request_booking_payment(
            booking=booking,
            phone=str(payload["phone"]),
            amount=int(payload["amount"]),
        )
    except ValueError as exc:
        return _error(str(exc), 400)
    except requests.RequestException:
        return _error("Failed to reach payment service", 502)

    return jsonify({"success": True, "data": payment_response}), 200


@bookings_bp.post("/bookings/payment-webhook")
def payment_webhook():
    expected_secret = current_app.config.get("WHYNE_WEBHOOK_SECRET", "")
    incoming_secret = request.headers.get("x-webhook-secret", "")
    if expected_secret and incoming_secret != expected_secret:
        return _error("Invalid webhook secret", 401)

    payload = request.get_json(silent=True) or {}
    missing = [field for field in ["bookingRef", "isFullPayment"] if field not in payload]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}", 400)

    booking = booking_service.apply_payment_webhook(
        booking_ref=str(payload["bookingRef"]),
        is_full_payment=bool(payload["isFullPayment"]),
        payment_ref=payload.get("paymentRef"),
    )
    if not booking:
        return jsonify({"success": True, "status": "ignored"}), 202

    return jsonify({"success": True, "status": "processed", "data": booking.to_dict()}), 200


@bookings_bp.get("/calendar")
def calendar_view():
    actor, auth_error = _get_actor({"PRODUCER"})
    if auth_error:
        return auth_error

    producer_id = request.args.get("producer_id")
    month_value = request.args.get("month")

    if not producer_id or not month_value:
        return _error("producer_id and month are required", 400)

    try:
        producer_id = int(producer_id)
        month_start = _parse_month(month_value).replace(day=1)
    except ValueError:
        return _error("Invalid producer_id or month format. Use month=YYYY-MM", 400)
    if producer_id != actor["user_id"]:
        return _error("producer_id must match authenticated producer", 403)

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
