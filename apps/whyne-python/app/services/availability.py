from datetime import date, time

from app.models import BookingStatus, SessionBooking


def is_time_slot_available(
    producer_id: int,
    session_date: date,
    start_time: time,
    end_time: time,
) -> bool:
    if start_time >= end_time:
        return False

    conflict = (
        SessionBooking.query.filter(
            SessionBooking.producer_id == producer_id,
            SessionBooking.session_date == session_date,
            SessionBooking.status != BookingStatus.CANCELLED,
            SessionBooking.start_time < end_time,
            SessionBooking.end_time > start_time,
        )
        .order_by(SessionBooking.start_time.asc())
        .first()
    )

    return conflict is None
