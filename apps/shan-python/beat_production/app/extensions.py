from dataclasses import dataclass

from flask import Flask
from flask_sqlalchemy import SQLAlchemy

try:
    from flask_migrate import Migrate
except ModuleNotFoundError:
    class Migrate:
        def init_app(self, app: Flask, db: SQLAlchemy) -> None:
            return None


try:
    from flask_jwt_extended import JWTManager
except ModuleNotFoundError:
    class JWTManager:
        def init_app(self, app: Flask) -> None:
            return None


try:
    from flask_caching import Cache
except ModuleNotFoundError:
    class Cache:
        def init_app(self, app: Flask) -> None:
            return None

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cache = Cache()


@dataclass
class QueueClient:
    name: str = "default"

    def enqueue(self, task_name: str, payload: dict | None = None) -> dict:
        return {
            "queued": True,
            "task": task_name,
            "queue": self.name,
            "payload": payload or {},
        }


task_queue = QueueClient()


def init_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cache.init_app(app)
