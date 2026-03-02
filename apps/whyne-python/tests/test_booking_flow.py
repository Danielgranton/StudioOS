from datetime import timedelta

from app.extensions import db
from app.models import BookingStatus, SessionBooking


def _create_booking(client, users):
    response = client.post(
        "/bookings",
        json={
            "artist_id": users["artist_id"],
            "producer_id": users["producer_id"],
            "session_date": "2026-03-15",
            "start_time": "10:00:00",
            "end_time": "12:00:00",
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    return payload["data"]["id"]


def test_full_lifecycle_pending_to_delivered(app, client, users):
    booking_id = _create_booking(client, users)

    response = client.post(
        f"/bookings/{booking_id}/approve", json={"producer_id": users["producer_id"]}
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.APPROVED.value

    response = client.post(f"/bookings/{booking_id}/start-recording")
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.RECORDING.value

    response = client.post(f"/bookings/{booking_id}/start-mixing")
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.MIXING.value

    with app.app_context():
        booking = db.session.get(SessionBooking, booking_id)
        assert booking.expected_ready_at == booking.mixing_started_at + timedelta(days=7)

    response = client.post(f"/bookings/{booking_id}/mark-ready")
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.READY.value

    response = client.post(f"/bookings/{booking_id}/deliver")
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.DELIVERED.value


def test_illegal_transition_fails(client, users):
    booking_id = _create_booking(client, users)
    response = client.post(f"/bookings/{booking_id}/deliver")

    assert response.status_code == 400
    assert response.get_json()["success"] is False
