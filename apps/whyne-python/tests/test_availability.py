from datetime import date, time

from app.extensions import db
from app.models import BookingStatus, SessionBooking
from app.services.availability import is_time_slot_available


def test_overlapping_bookings_block_slot(app, users):
    with app.app_context():
        booking = SessionBooking(
            artist_id=users["artist_id"],
            producer_id=users["producer_id"],
            session_date=date(2026, 3, 10),
            start_time=time(10, 0, 0),
            end_time=time(12, 0, 0),
            status=BookingStatus.APPROVED,
        )
        db.session.add(booking)
        db.session.commit()

        assert (
            is_time_slot_available(
                users["producer_id"],
                date(2026, 3, 10),
                time(11, 0, 0),
                time(13, 0, 0),
            )
            is False
        )


def test_end_time_equal_start_time_is_allowed(app, users):
    with app.app_context():
        booking = SessionBooking(
            artist_id=users["artist_id"],
            producer_id=users["producer_id"],
            session_date=date(2026, 3, 11),
            start_time=time(10, 0, 0),
            end_time=time(12, 0, 0),
            status=BookingStatus.APPROVED,
        )
        db.session.add(booking)
        db.session.commit()

        assert (
            is_time_slot_available(
                users["producer_id"],
                date(2026, 3, 11),
                time(12, 0, 0),
                time(13, 0, 0),
            )
            is True
        )


def test_cancelled_booking_does_not_block_slot(app, users):
    with app.app_context():
        booking = SessionBooking(
            artist_id=users["artist_id"],
            producer_id=users["producer_id"],
            session_date=date(2026, 3, 12),
            start_time=time(14, 0, 0),
            end_time=time(16, 0, 0),
            status=BookingStatus.CANCELLED,
        )
        db.session.add(booking)
        db.session.commit()

        assert (
            is_time_slot_available(
                users["producer_id"],
                date(2026, 3, 12),
                time(15, 0, 0),
                time(15, 30, 0),
            )
            is True
        )
