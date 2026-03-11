import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.extensions import db
from app.main import create_app
from app.models.studio import Studio
from app.models.user import User, UserRole


@pytest.fixture
def app():
    flask_app = create_app("testing")

    with flask_app.app_context():
        db.create_all()

        owner = User(
            name="Owner",
            email="owner@test.local",
            role=UserRole.OWNER,
            phone="+254700000001",
        )
        producer = User(
            name="Producer",
            email="producer@test.local",
            role=UserRole.PRODUCER,
            phone="+254700000002",
        )
        artist = User(
            name="Artist",
            email="artist@test.local",
            role=UserRole.ARTIST,
            phone="+254700000003",
        )
        db.session.add_all([owner, producer, artist])
        db.session.flush()

        studio = Studio(
            owner_id=owner.id,
            name="Test Studio",
            location="Nairobi",
            verified=True,
        )
        db.session.add(studio)
        db.session.commit()

        yield flask_app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
