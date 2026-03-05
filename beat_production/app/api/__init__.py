from app.api.auth import auth_bp
from app.api.beats import beats_bp
from app.api.dashboard import dashboard_bp
from app.api.marketplace import marketplace_bp
from app.api.payments import payments_bp
from app.api.projects import projects_bp

__all__ = [
    "auth_bp",
    "projects_bp",
    "beats_bp",
    "payments_bp",
    "marketplace_bp",
    "dashboard_bp",
]
