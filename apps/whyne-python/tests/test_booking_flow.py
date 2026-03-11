from datetime import timedelta

from app.extensions import db
from app.models import BookingPaymentStatus, BookingStatus, SessionBooking


def _create_booking(client, users, auth_headers):
    response = client.post(
        "/bookings",
        json={
            "artist_id": users["artist_id"],
            "producer_id": users["producer_id"],
            "studio_id": "studio-123",
            "project_title": "Sample Session",
            "session_date": "2026-03-15",
            "start_time": "10:00:00",
            "end_time": "12:00:00",
        },
        headers=auth_headers["artist"],
    )
    assert response.status_code == 201
    payload = response.get_json()
    return payload["data"]["id"]


def test_full_lifecycle_pending_to_delivered(app, client, users, auth_headers):
    booking_id = _create_booking(client, users, auth_headers)

    response = client.post(
        f"/bookings/{booking_id}/approve",
        json={"producer_id": users["producer_id"]},
        headers=auth_headers["producer"],
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.APPROVED.value

    response = client.post(
        f"/bookings/{booking_id}/start-recording", headers=auth_headers["producer"]
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.RECORDING.value

    response = client.post(
        f"/bookings/{booking_id}/start-mixing", headers=auth_headers["producer"]
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.MIXING.value

    with app.app_context():
        booking = db.session.get(SessionBooking, booking_id)
        assert booking.expected_ready_at == booking.mixing_started_at + timedelta(days=7)

    response = client.post(
        f"/bookings/{booking_id}/mark-ready", headers=auth_headers["producer"]
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.READY.value

    response = client.post(f"/bookings/{booking_id}/deliver", headers=auth_headers["artist"])
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == BookingStatus.DELIVERED.value


def test_illegal_transition_fails(client, users, auth_headers):
    booking_id = _create_booking(client, users, auth_headers)
    response = client.post(
        f"/bookings/{booking_id}/deliver", headers=auth_headers["producer"]
    )

    assert response.status_code == 400
    assert response.get_json()["success"] is False


def test_missing_auth_headers_rejected(client, users):
    response = client.post(
        "/bookings",
        json={
            "artist_id": users["artist_id"],
            "producer_id": users["producer_id"],
            "studio_id": "studio-123",
            "project_title": "Sample Session",
            "session_date": "2026-03-15",
            "start_time": "10:00:00",
            "end_time": "12:00:00",
        },
    )
    assert response.status_code == 401


def test_payment_webhook_updates_booking_payment_status(app, client, users, auth_headers):
    booking_id = _create_booking(client, users, auth_headers)
    response = client.post(
        f"/bookings/{booking_id}/approve",
        json={"producer_id": users["producer_id"]},
        headers=auth_headers["producer"],
    )
    assert response.status_code == 200
    booking_ref = response.get_json()["data"]["booking_ref"]

    webhook_resp = client.post(
        "/bookings/payment-webhook",
        json={
            "bookingRef": booking_ref,
            "isFullPayment": True,
            "paymentRef": "MPE-12345",
        },
    )
    assert webhook_resp.status_code == 200
    assert webhook_resp.get_json()["status"] == "processed"

    with app.app_context():
        booking = db.session.get(SessionBooking, booking_id)
        assert booking.payment_status == BookingPaymentStatus.FULLY_PAID
        assert booking.payment_ref == "MPE-12345"
