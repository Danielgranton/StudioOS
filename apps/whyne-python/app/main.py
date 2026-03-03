from __future__ import annotations

import atexit
import os

from flask import Flask

from app.api import bookings_bp
from app.automation import run_auto_ready_transition_job, run_tomorrow_reminder_job
from app.extensions import db, migrate, scheduler


def create_app(test_config: dict | None = None) -> Flask:
	app = Flask(__name__)

	app.config.from_mapping(
		SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///booking_dev.db"),
		SQLALCHEMY_TRACK_MODIFICATIONS=False,
		SCHEDULER_ENABLED=True,
		GRANTON_BASE_URL=os.getenv("GRANTON_BASE_URL", "http://localhost:3000"),
		GRANTON_SERVICE_SECRET=os.getenv("GRANTON_SERVICE_SECRET", ""),
		GRANTON_TIMEOUT_SECONDS=int(os.getenv("GRANTON_TIMEOUT_SECONDS", "8")),
		VALIDATE_REMOTE_USERS=os.getenv("VALIDATE_REMOTE_USERS", "true").lower() == "true",
		SYNC_PROJECTS=os.getenv("SYNC_PROJECTS", "true").lower() == "true",
		SHAN_BASE_URL=os.getenv("SHAN_BASE_URL", "http://localhost:5000"),
		SHAN_TIMEOUT_SECONDS=int(os.getenv("SHAN_TIMEOUT_SECONDS", "8")),
		WHYNE_WEBHOOK_SECRET=os.getenv("WHYNE_WEBHOOK_SECRET", ""),
	)

	if test_config:
		app.config.update(test_config)

	_init_extensions(app)
	_register_blueprints(app)

	with app.app_context():
		db.create_all()

	if app.config.get("SCHEDULER_ENABLED", True) and not app.config.get("TESTING", False):
		_start_scheduler(app)

	return app


def _init_extensions(app: Flask) -> None:
	db.init_app(app)
	migrate.init_app(app, db)


def _register_blueprints(app: Flask) -> None:
	app.register_blueprint(bookings_bp)


def _start_scheduler(app: Flask) -> None:
	if scheduler.running:
		return

	def auto_ready_job_wrapper() -> None:
		with app.app_context():
			run_auto_ready_transition_job()

	def reminder_job_wrapper() -> None:
		with app.app_context():
			run_tomorrow_reminder_job()

	scheduler.add_job(
		auto_ready_job_wrapper,
		trigger="cron",
		hour=0,
		minute=5,
		id="auto-ready-transition",
		replace_existing=True,
	)
	scheduler.add_job(
		reminder_job_wrapper,
		trigger="cron",
		hour=9,
		minute=0,
		id="tomorrow-session-reminders",
		replace_existing=True,
	)
	scheduler.start()

	atexit.register(lambda: scheduler.shutdown(wait=False) if scheduler.running else None)


if __name__ == "__main__":
	create_app().run(debug=True)
