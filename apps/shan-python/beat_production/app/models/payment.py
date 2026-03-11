from enum import Enum

from app.extensions import db
from app.utils.datetime import utc_now


class PaymentProvider(str, Enum):
    MPESA = "MPESA"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    beat_id = db.Column(db.Integer, db.ForeignKey("beats.id"), nullable=True)

    provider = db.Column(
        db.Enum(PaymentProvider, native_enum=False, validate_strings=True),
        nullable=False,
        default=PaymentProvider.MPESA,
    )
    txn_ref = db.Column(db.String(120), unique=True, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(
        db.Enum(PaymentStatus, native_enum=False, validate_strings=True),
        nullable=False,
        default=PaymentStatus.PENDING,
    )

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
