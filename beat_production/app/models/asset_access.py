from enum import Enum

from app.extensions import db
from app.utils.datetime import utc_now


class AssetType(str, Enum):
    BEAT = "BEAT"
    PROJECT_FILE = "PROJECT_FILE"


class AssetAccess(db.Model):
    __tablename__ = "asset_access"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    asset_type = db.Column(
        db.Enum(AssetType, native_enum=False, validate_strings=True),
        nullable=False,
    )
    asset_id = db.Column(db.Integer, nullable=False)
    can_download = db.Column(db.Boolean, nullable=False, default=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True, default=utc_now)
