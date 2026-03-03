import pytest

from app.extensions import db
from app.main import create_app
from app.models import User, UserRole


@pytest.fixture
def app():
    flask_app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "SCHEDULER_ENABLED": False,
        }
    )

    with flask_app.app_context():
        db.create_all()

        artist = User(name="Artist One", email="artist@example.com", role=UserRole.ARTIST)
        producer = User(
            name="Producer One", email="producer@example.com", role=UserRole.PRODUCER
        )
        db.session.add_all([artist, producer])
        db.session.commit()

        yield flask_app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def users(app):
    with app.app_context():
        artist = User.query.filter_by(email="artist@example.com").first()
        producer = User.query.filter_by(email="producer@example.com").first()
        return {"artist_id": artist.id, "producer_id": producer.id}
