from flask import Flask

from app.api.auth import auth_bp
from app.api.beats import beats_bp
from app.api.dashboard import dashboard_bp
from app.api.marketplace import marketplace_bp
from app.api.payments import payments_bp
from app.api.projects import projects_bp
from app.config import get_config
from app.extensions import init_extensions


def create_app(config_name: str = "development") -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    init_extensions(app)
    _register_blueprints(app)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "service": "beat_production"}

    return app


def _register_blueprints(app: Flask) -> None:
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(projects_bp, url_prefix="/projects")
    app.register_blueprint(beats_bp, url_prefix="/beats")
    app.register_blueprint(payments_bp, url_prefix="/payments")
    app.register_blueprint(marketplace_bp, url_prefix="/marketplace")
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard")


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5050, debug=True)
