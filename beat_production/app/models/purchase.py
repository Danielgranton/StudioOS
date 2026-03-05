from enum import Enum

from app.extensions import db
from app.utils.datetime import utc_now


class BeatLicenseType(str, Enum):
    BASIC = "BASIC"
    PREMIUM = "PREMIUM"
    EXCLUSIVE = "EXCLUSIVE"


class BeatPurchase(db.Model):
    __tablename__ = "beat_purchases"

    id = db.Column(db.Integer, primary_key=True)
    beat_id = db.Column(db.Integer, db.ForeignKey("beats.id"), nullable=False)
    artist_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    license_type = db.Column(
        db.Enum(BeatLicenseType, native_enum=False, validate_strings=True),
        nullable=False,
    )
    amount_paid = db.Column(db.Numeric(10, 2), nullable=False)
    transaction_id = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
