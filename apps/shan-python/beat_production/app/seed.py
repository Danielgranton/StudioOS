from datetime import timedelta
from decimal import Decimal

from app.main import create_app
from app.extensions import db
from app.models.asset_access import AssetAccess, AssetType
from app.models.beat import Beat
from app.models.beat_license import BeatLicense
from app.models.payment import Payment, PaymentProvider, PaymentStatus
from app.models.project import Project, ProjectStatus
from app.models.purchase import BeatLicenseType, BeatPurchase
from app.models.studio import Studio
from app.models.user import User, UserRole
from app.utils.datetime import utc_now


def seed_data() -> None:
    app = create_app("development")

    with app.app_context():
        db.create_all()

        owner = _get_or_create_user(
            email="owner@studioos.local",
            name="Studio Owner",
            role=UserRole.OWNER,
            phone="+254700000001",
        )
        producer = _get_or_create_user(
            email="producer@studioos.local",
            name="Lead Producer",
            role=UserRole.PRODUCER,
            phone="+254700000002",
        )
        artist = _get_or_create_user(
            email="artist@studioos.local",
            name="Sample Artist",
            role=UserRole.ARTIST,
            phone="+254700000003",
        )

        studio = Studio.query.filter_by(name="Studio OS HQ").first()
        if not studio:
            studio = Studio(
                owner_id=owner.id,
                name="Studio OS HQ",
                location="Nairobi",
                verified=True,
            )
            db.session.add(studio)
            db.session.flush()

        beat = Beat.query.filter_by(title="Nairobi Nights").first()
        if not beat:
            beat = Beat(
                producer_id=producer.id,
                title="Nairobi Nights",
                genre="Afrobeats",
                mood="Energetic",
                bpm=102,
                preview_url="https://cdn.studioos.local/previews/nairobi-nights.mp3",
                full_url="https://cdn.studioos.local/full/nairobi-nights.wav",
                is_available=True,
            )
            db.session.add(beat)
            db.session.flush()

        _upsert_license(
            beat.id,
            BeatLicenseType.BASIC,
            Decimal("2000.00"),
            {"usage": "non-exclusive", "downloads": 1},
        )
        _upsert_license(
            beat.id,
            BeatLicenseType.PREMIUM,
            Decimal("5000.00"),
            {"usage": "wav + stems", "downloads": 3},
        )
        _upsert_license(
            beat.id,
            BeatLicenseType.EXCLUSIVE,
            Decimal("15000.00"),
            {"usage": "exclusive", "downloads": 999},
        )

        project = Project.query.filter_by(title="Nairobi Nights Single").first()
        if not project:
            project = Project(
                artist_id=artist.id,
                producer_id=producer.id,
                studio_id=studio.id,
                title="Nairobi Nights Single",
                status=ProjectStatus.MIXING,
                progress=40,
                eta_date=utc_now() + timedelta(days=5),
                deposit_required=True,
                deposit_paid=True,
                balance_due=Decimal("3000.00"),
            )
            db.session.add(project)
            db.session.flush()

        payment = Payment.query.filter_by(txn_ref="MPESA-DEMO-0001").first()
        if not payment:
            payment = Payment(
                user_id=artist.id,
                project_id=project.id,
                beat_id=beat.id,
                provider=PaymentProvider.MPESA,
                txn_ref="MPESA-DEMO-0001",
                amount=Decimal("2000.00"),
                status=PaymentStatus.CONFIRMED,
            )
            db.session.add(payment)
            db.session.flush()

        purchase = BeatPurchase.query.filter_by(transaction_id="MPESA-DEMO-0001").first()
        if not purchase:
            purchase = BeatPurchase(
                beat_id=beat.id,
                artist_id=artist.id,
                license_type=BeatLicenseType.BASIC,
                amount_paid=Decimal("2000.00"),
                transaction_id="MPESA-DEMO-0001",
            )
            db.session.add(purchase)
            db.session.flush()

        access = AssetAccess.query.filter_by(
            user_id=artist.id,
            asset_type=AssetType.BEAT,
            asset_id=beat.id,
        ).first()
        if not access:
            access = AssetAccess(
                user_id=artist.id,
                asset_type=AssetType.BEAT,
                asset_id=beat.id,
                can_download=True,
                expires_at=utc_now() + timedelta(days=30),
            )
            db.session.add(access)

        db.session.commit()
        print("Seed complete: demo users, studio, beat, licenses, project, payment, purchase, and asset access created.")


def _get_or_create_user(email: str, name: str, role: UserRole, phone: str) -> User:
    user = User.query.filter_by(email=email).first()
    if user:
        return user

    user = User(email=email, name=name, role=role, phone=phone)
    db.session.add(user)
    db.session.flush()
    return user


def _upsert_license(beat_id: int, license_type: BeatLicenseType, price: Decimal, terms: dict) -> None:
    row = BeatLicense.query.filter_by(beat_id=beat_id, type=license_type).first()
    if not row:
        row = BeatLicense(beat_id=beat_id, type=license_type)
        db.session.add(row)

    row.price = price
    row.terms_json = terms


if __name__ == "__main__":
    seed_data()
