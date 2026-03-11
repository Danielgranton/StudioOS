from enum import Enum

from app.extensions import db
from app.utils.datetime import utc_now


class UserRole(str, Enum):
    ARTIST = "ARTIST"
    PRODUCER = "PRODUCER"
    OWNER = "OWNER"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(
        db.Enum(UserRole, native_enum=False, validate_strings=True),
        nullable=False,
    )
    phone = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
