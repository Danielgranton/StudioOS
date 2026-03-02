from datetime import datetime
from enum import Enum

from app.extensions import db


class UserRole(str, Enum):
    ARTIST = "ARTIST"
    PRODUCER = "PRODUCER"
    ADMIN = "ADMIN"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    role = db.Column(
        db.Enum(UserRole, native_enum=False, validate_strings=True), nullable=False
    )
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
