from flask import current_app

from app.services.booking_service import (
    auto_mark_due_mixing_as_ready,
    get_tomorrow_approved_bookings,
)


def run_auto_ready_transition_job() -> None:
    transitioned = auto_mark_due_mixing_as_ready()
    for booking in transitioned:
        current_app.logger.info(
            "AUTO_READY booking_id=%s status=%s ready_at=%s",
            booking.id,
            booking.status.value,
            booking.ready_at.isoformat() if booking.ready_at else None,
        )


def run_tomorrow_reminder_job() -> None:
    bookings = get_tomorrow_approved_bookings()
    for booking in bookings:
        current_app.logger.info(
            "REMINDER placeholder booking_id=%s producer_id=%s artist_id=%s session_date=%s start=%s",
            booking.id,
            booking.producer_id,
            booking.artist_id,
            booking.session_date.isoformat(),
            booking.start_time.isoformat(),
        )
