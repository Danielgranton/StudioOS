from enum import Enum

from app.extensions import db
from app.utils.datetime import utc_now


class ProjectStatus(str, Enum):
    RECORDING = "RECORDING"
    MIXING = "MIXING"
    REVIEW = "REVIEW"
    PAYMENT = "PAYMENT"
    RELEASE = "RELEASE"
    STREAMING = "STREAMING"
    ANALYTICS = "ANALYTICS"


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    artist_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    producer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    studio_id = db.Column(db.Integer, db.ForeignKey("studios.id"), nullable=False)

    title = db.Column(db.String(160), nullable=False)
    status = db.Column(
        db.Enum(ProjectStatus, native_enum=False, validate_strings=True),
        nullable=False,
        default=ProjectStatus.RECORDING,
    )
    progress = db.Column(db.Integer, nullable=False, default=0)
    eta_date = db.Column(db.DateTime(timezone=True), nullable=True)

    deposit_required = db.Column(db.Boolean, nullable=False, default=True)
    deposit_paid = db.Column(db.Boolean, nullable=False, default=False)
    balance_due = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
