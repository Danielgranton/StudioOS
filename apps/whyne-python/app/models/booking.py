from __future__ import annotations

from datetime import date, datetime, time, timedelta
from enum import Enum

from app.extensions import db


class BookingStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    RECORDING = "RECORDING"
    MIXING = "MIXING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class BookingPaymentStatus(str, Enum):
    BOOKED = "BOOKED"
    FULLY_PAID = "FULLY_PAID"


class SessionBooking(db.Model):
    __tablename__ = "session_bookings"

    id = db.Column(db.Integer, primary_key=True)
    # IDs come from granton-nest User table and are validated over REST.
    artist_id = db.Column(db.Integer, nullable=False)
    producer_id = db.Column(db.Integer, nullable=False)
    studio_id = db.Column(db.String(255), nullable=False)
    project_title = db.Column(db.String(255), nullable=False)
    booking_ref = db.Column(db.String(64), unique=True, nullable=False)
    project_id = db.Column(db.Integer, nullable=True)
    payment_ref = db.Column(db.String(255), nullable=True)
    payment_status = db.Column(
        db.Enum(BookingPaymentStatus, native_enum=False, validate_strings=True),
        nullable=False,
        default=BookingPaymentStatus.BOOKED,
    )
    session_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

    status = db.Column(
        db.Enum(BookingStatus, native_enum=False, validate_strings=True),
        nullable=False,
        default=BookingStatus.PENDING,
    )

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    approved_at = db.Column(db.DateTime, nullable=True)
    recording_started_at = db.Column(db.DateTime, nullable=True)
    mixing_started_at = db.Column(db.DateTime, nullable=True)
    expected_ready_at = db.Column(db.DateTime, nullable=True)
    ready_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)

    @staticmethod
    def _allowed_transitions() -> dict[BookingStatus, set[BookingStatus]]:
        return {
            BookingStatus.PENDING: {BookingStatus.APPROVED, BookingStatus.CANCELLED},
            BookingStatus.APPROVED: {BookingStatus.RECORDING, BookingStatus.CANCELLED},
            BookingStatus.RECORDING: {BookingStatus.MIXING, BookingStatus.CANCELLED},
            BookingStatus.MIXING: {BookingStatus.READY, BookingStatus.CANCELLED},
            BookingStatus.READY: {BookingStatus.DELIVERED},
            BookingStatus.DELIVERED: set(),
            BookingStatus.CANCELLED: set(),
        }

    def can_transition_to(self, new_status: BookingStatus | str) -> bool:
        if isinstance(new_status, str):
            try:
                new_status = BookingStatus(new_status)
            except ValueError:
                return False

        allowed = self._allowed_transitions().get(self.status, set())
        return new_status in allowed

    def transition_to(
        self, new_status: BookingStatus | str, at_time: datetime | None = None
    ) -> None:
        if isinstance(new_status, str):
            new_status = BookingStatus(new_status)

        if not self.can_transition_to(new_status):
            raise ValueError(f"Illegal status transition: {self.status} -> {new_status}")

        now = at_time or datetime.utcnow()

        if new_status == BookingStatus.APPROVED:
            self.approved_at = now
        elif new_status == BookingStatus.RECORDING:
            self.recording_started_at = now
        elif new_status == BookingStatus.MIXING:
            self.mixing_started_at = now
            self.expected_ready_at = now + timedelta(days=7)
        elif new_status == BookingStatus.READY:
            self.ready_at = now
        elif new_status == BookingStatus.DELIVERED:
            self.delivered_at = now

        self.status = new_status

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "artist_id": self.artist_id,
            "producer_id": self.producer_id,
            "studio_id": self.studio_id,
            "project_title": self.project_title,
            "booking_ref": self.booking_ref,
            "project_id": self.project_id,
            "payment_ref": self.payment_ref,
            "payment_status": self.payment_status.value,
            "session_date": self.session_date.isoformat() if self.session_date else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "recording_started_at": self.recording_started_at.isoformat()
            if self.recording_started_at
            else None,
            "mixing_started_at": self.mixing_started_at.isoformat()
            if self.mixing_started_at
            else None,
            "expected_ready_at": self.expected_ready_at.isoformat()
            if self.expected_ready_at
            else None,
            "ready_at": self.ready_at.isoformat() if self.ready_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
        }
