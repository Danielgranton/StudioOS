from app.extensions import db
from app.main import create_app
from app.models import User, UserRole


def seed_users() -> None:
    app = create_app({"SCHEDULER_ENABLED": False})

    with app.app_context():
        db.create_all()

        defaults = [
            {
                "name": "Sample Artist",
                "email": "artist1@example.com",
                "role": UserRole.ARTIST,
            },
            {
                "name": "Sample Producer",
                "email": "producer1@example.com",
                "role": UserRole.PRODUCER,
            },
            {
                "name": "Sample Artist Two",
                "email": "artist2@example.com",
                "role": UserRole.ARTIST,
            },
            {
                "name": "Sample Producer Two",
                "email": "producer2@example.com",
                "role": UserRole.PRODUCER,
            },
        ]

        created = 0
        for payload in defaults:
            existing = User.query.filter_by(email=payload["email"]).first()
            if existing:
                continue

            db.session.add(User(**payload))
            created += 1

        db.session.commit()

        total = User.query.count()
        print(f"Seed complete. Created {created} users. Total users: {total}.")


if __name__ == "__main__":
    seed_users()
