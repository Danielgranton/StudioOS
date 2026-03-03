import pytest

from app.extensions import db
from app.main import create_app


@pytest.fixture
def app():
    flask_app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "SCHEDULER_ENABLED": False,
            "VALIDATE_REMOTE_USERS": False,
            "SYNC_PROJECTS": False,
        }
    )

    with flask_app.app_context():
        db.create_all()

        yield flask_app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def users(app):
    return {"artist_id": 1, "producer_id": 2}


@pytest.fixture
def auth_headers(users):
    return {
        "artist": {
            "x-user-id": str(users["artist_id"]),
            "x-user-role": "ARTIST",
        },
        "producer": {
            "x-user-id": str(users["producer_id"]),
            "x-user-role": "PRODUCER",
        },
    }
