from app.extensions import db
from app.utils.datetime import utc_now


class Beat(db.Model):
    __tablename__ = "beats"

    id = db.Column(db.Integer, primary_key=True)
    producer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    title = db.Column(db.String(160), nullable=False)
    genre = db.Column(db.String(60), nullable=False)
    bpm = db.Column(db.Integer, nullable=False)
    mood = db.Column(db.String(60), nullable=True)

    preview_url = db.Column(db.String(255), nullable=False)
    full_url = db.Column(db.String(255), nullable=False)
    is_available = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
