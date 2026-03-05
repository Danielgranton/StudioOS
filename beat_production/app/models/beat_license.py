from app.extensions import db
from app.models.purchase import BeatLicenseType


class BeatLicense(db.Model):
    __tablename__ = "beat_licenses"

    id = db.Column(db.Integer, primary_key=True)
    beat_id = db.Column(db.Integer, db.ForeignKey("beats.id"), nullable=False)
    type = db.Column(
        db.Enum(BeatLicenseType, native_enum=False, validate_strings=True),
        nullable=False,
    )
    price = db.Column(db.Numeric(10, 2), nullable=False)
    terms_json = db.Column(db.JSON, nullable=True)
