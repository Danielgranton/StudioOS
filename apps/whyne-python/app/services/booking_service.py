from __future__ import annotations

from datetime import date, datetime, time, timedelta
from uuid import uuid4

from flask import current_app

from app.extensions import db
from app.models import BookingPaymentStatus, BookingStatus, SessionBooking
from app.services.availability import is_time_slot_available
from app.services.granton_client import create_project_from_booking, validate_user_role


def _build_booking_ref() -> str:
    return f"BKG-{uuid4().hex[:12].upper()}"


def get_booking_or_none(booking_id: int) -> SessionBooking | None:
    return db.session.get(SessionBooking, booking_id)


def create_pending_booking(
    artist_id: int,
    producer_id: int,
    studio_id: str,
    project_title: str,
    session_date: date,
    start_time: time,
    end_time: time,
) -> SessionBooking:
    if start_time >= end_time:
        raise ValueError("start_time must be earlier than end_time")

    if not validate_user_role(artist_id, "ARTIST"):
        raise LookupError(f"Artist not found or invalid role: {artist_id}")
    if not validate_user_role(producer_id, "PRODUCER"):
        raise LookupError(f"Producer not found or invalid role: {producer_id}")

    if not is_time_slot_available(producer_id, session_date, start_time, end_time):
        raise ValueError("Requested time slot is not available")

    booking = SessionBooking(
        artist_id=artist_id,
        producer_id=producer_id,
        studio_id=studio_id,
        project_title=project_title,
        booking_ref=_build_booking_ref(),
        session_date=session_date,
        start_time=start_time,
        end_time=end_time,
        status=BookingStatus.PENDING,
        payment_status=BookingPaymentStatus.BOOKED,
    )
    db.session.add(booking)
    db.session.commit()
    return booking


def approve_booking(booking: SessionBooking, acting_producer_id: int) -> SessionBooking:
    if acting_producer_id != booking.producer_id:
        raise PermissionError("Only the assigned producer can approve this booking")

    booking.transition_to(BookingStatus.APPROVED)
    if current_app.config.get("SYNC_PROJECTS", True):
        project = create_project_from_booking(
            {
                "title": booking.project_title,
                "artistId": booking.artist_id,
                "producerId": booking.producer_id,
                "studioId": booking.studio_id,
                "bookingRef": booking.booking_ref,
                "paymentRef": booking.payment_ref or booking.booking_ref,
                "paymentStatus": booking.payment_status.value,
            }
        )
        booking.project_id = project.get("id")
    db.session.commit()
    return booking


def transition_booking(
    booking: SessionBooking,
    target_status: BookingStatus,
    at_time: datetime | None = None,
) -> SessionBooking:
    booking.transition_to(target_status, at_time=at_time)
    db.session.commit()
    return booking


def find_calendar_bookings(producer_id: int, month_start: date, month_end: date) -> list[SessionBooking]:
    return (
        SessionBooking.query.filter(
            SessionBooking.producer_id == producer_id,
            SessionBooking.session_date >= month_start,
            SessionBooking.session_date <= month_end,
        )
        .order_by(SessionBooking.session_date.asc(), SessionBooking.start_time.asc())
        .all()
    )


def auto_mark_due_mixing_as_ready(now: datetime | None = None) -> list[SessionBooking]:
    current_time = now or datetime.utcnow()
    due_bookings = (
        SessionBooking.query.filter(
            SessionBooking.status == BookingStatus.MIXING,
            SessionBooking.expected_ready_at.isnot(None),
            SessionBooking.expected_ready_at <= current_time,
        )
        .order_by(SessionBooking.expected_ready_at.asc())
        .all()
    )

    for booking in due_bookings:
        booking.transition_to(BookingStatus.READY, at_time=current_time)

    if due_bookings:
        db.session.commit()

    return due_bookings


def get_tomorrow_approved_bookings(now: datetime | None = None) -> list[SessionBooking]:
    current_time = now or datetime.utcnow()
    tomorrow = current_time.date() + timedelta(days=1)
    return (
        SessionBooking.query.filter(
            SessionBooking.status == BookingStatus.APPROVED,
            SessionBooking.session_date == tomorrow,
        )
        .order_by(SessionBooking.start_time.asc())
        .all()
    )


def request_booking_payment(booking: SessionBooking, phone: str, amount: int) -> dict:
    if booking.status != BookingStatus.APPROVED:
        raise ValueError("Booking must be APPROVED before requesting payment")
    if amount <= 0:
        raise ValueError("amount must be greater than 0")

    from app.services.payment_client import request_stk_push

    response = request_stk_push(phone=phone, amount=amount, booking_ref=booking.booking_ref)
    current_app.logger.info(
        "PAYMENT_REQUEST booking_ref=%s checkout_request_id=%s",
        booking.booking_ref,
        response.get("checkout_request_id"),
    )
    return response


def apply_payment_webhook(*, booking_ref: str, is_full_payment: bool, payment_ref: str | None) -> SessionBooking | None:
    booking = SessionBooking.query.filter_by(booking_ref=booking_ref).first()
    if not booking:
        return None

    booking.payment_ref = payment_ref or booking.payment_ref or booking_ref
    if is_full_payment:
        booking.payment_status = BookingPaymentStatus.FULLY_PAID
    db.session.commit()
    return booking
