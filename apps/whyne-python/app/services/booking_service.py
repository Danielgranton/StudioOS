from __future__ import annotations

from datetime import date, datetime, time, timedelta

from app.extensions import db
from app.models import BookingStatus, SessionBooking, User
from app.services.availability import is_time_slot_available


def _get_user_or_raise(user_id: int) -> User:
    user = db.session.get(User, user_id)
    if not user:
        raise LookupError(f"User not found: {user_id}")
    return user


def get_booking_or_none(booking_id: int) -> SessionBooking | None:
    return db.session.get(SessionBooking, booking_id)


def create_pending_booking(
    artist_id: int,
    producer_id: int,
    session_date: date,
    start_time: time,
    end_time: time,
) -> SessionBooking:
    if start_time >= end_time:
        raise ValueError("start_time must be earlier than end_time")

    _get_user_or_raise(artist_id)
    _get_user_or_raise(producer_id)

    if not is_time_slot_available(producer_id, session_date, start_time, end_time):
        raise ValueError("Requested time slot is not available")

    booking = SessionBooking(
        artist_id=artist_id,
        producer_id=producer_id,
        session_date=session_date,
        start_time=start_time,
        end_time=end_time,
        status=BookingStatus.PENDING,
    )
    db.session.add(booking)
    db.session.commit()
    return booking


def approve_booking(booking: SessionBooking, acting_producer_id: int) -> SessionBooking:
    if acting_producer_id != booking.producer_id:
        raise PermissionError("Only the assigned producer can approve this booking")

    booking.transition_to(BookingStatus.APPROVED)
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
