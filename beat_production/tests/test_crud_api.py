from app.models.beat import Beat
from app.models.beat_license import BeatLicense
from app.extensions import db
from app.models.asset_access import AssetAccess, AssetType
from app.models.payment import Payment, PaymentStatus
from app.models.project import Project, ProjectStatus
from app.models.purchase import BeatLicenseType, BeatPurchase
from app.models.studio import Studio
from app.models.user import User


def test_create_and_get_project(app, client):
    with app.app_context():
        artist = User.query.filter_by(email="artist@test.local").first()
        producer = User.query.filter_by(email="producer@test.local").first()
        studio = Studio.query.filter_by(name="Test Studio").first()

    response = client.post(
        "/projects",
        json={
            "artist_id": artist.id,
            "producer_id": producer.id,
            "studio_id": studio.id,
            "title": "First Single",
            "status": "RECORDING",
            "progress": 15,
            "deposit_required": True,
            "deposit_paid": False,
            "balance_due": 3000,
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["title"] == "First Single"

    get_response = client.get(f"/projects/{data['id']}")
    assert get_response.status_code == 200
    assert get_response.get_json()["status"] == "RECORDING"


def test_patch_project_status_transition(app, client):
    with app.app_context():
        artist = User.query.filter_by(email="artist@test.local").first()
        producer = User.query.filter_by(email="producer@test.local").first()
        studio = Studio.query.filter_by(name="Test Studio").first()

        project = Project(
            artist_id=artist.id,
            producer_id=producer.id,
            studio_id=studio.id,
            title="Transition Song",
            status=ProjectStatus.RECORDING,
            progress=20,
            deposit_required=True,
            deposit_paid=True,
            balance_due=0,
        )
        db.session.add(project)
        db.session.commit()
        project_id = project.id

    response = client.patch(
        f"/projects/{project_id}/status",
        json={"to_status": "MIXING", "progress": 40},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "MIXING"


def test_create_and_list_beats(app, client):
    with app.app_context():
        producer = User.query.filter_by(email="producer@test.local").first()

    response = client.post(
        "/beats",
        json={
            "producer_id": producer.id,
            "title": "Sunrise",
            "genre": "Afrobeats",
            "mood": "Happy",
            "bpm": 110,
            "preview_url": "https://example.com/preview.mp3",
            "full_url": "https://example.com/full.wav",
            "is_available": True,
        },
    )
    assert response.status_code == 201

    list_response = client.get("/beats")
    assert list_response.status_code == 200
    assert len(list_response.get_json()) >= 1


def test_purchase_beat_creates_payment_purchase_and_access(app, client):
    with app.app_context():
        producer = User.query.filter_by(email="producer@test.local").first()
        artist = User.query.filter_by(email="artist@test.local").first()

        beat = Beat(
            producer_id=producer.id,
            title="Licensable Beat",
            genre="Afrobeats",
            mood="Cool",
            bpm=100,
            preview_url="https://example.com/lic-preview.mp3",
            full_url="https://example.com/lic-full.wav",
            is_available=True,
        )
        db.session.add(beat)
        db.session.flush()

        db.session.add(
            BeatLicense(
                beat_id=beat.id,
                type=BeatLicenseType.BASIC,
                price=2000,
                terms_json={"usage": "non-exclusive"},
            )
        )
        db.session.commit()
        beat_id = beat.id
        artist_id = artist.id

    response = client.post(
        f"/beats/{beat_id}/purchase",
        json={
            "artist_id": artist_id,
            "license_type": "BASIC",
            "txn_ref": "TXN-PURCHASE-001",
            "amount_paid": 2000,
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["purchase"]["license_type"] == "BASIC"
    assert body["payment"]["status"] == "CONFIRMED"
    assert body["asset_access"]["can_download"] is True

    with app.app_context():
        purchase = BeatPurchase.query.filter_by(transaction_id="TXN-PURCHASE-001").first()
        payment = Payment.query.filter_by(txn_ref="TXN-PURCHASE-001").first()
        access = AssetAccess.query.filter_by(
            user_id=artist_id,
            asset_type=AssetType.BEAT,
            asset_id=beat_id,
        ).first()

        assert purchase is not None
        assert payment is not None
        assert payment.status == PaymentStatus.CONFIRMED
        assert access is not None
        assert access.can_download is True


def test_purchase_exclusive_marks_beat_unavailable(app, client):
    with app.app_context():
        producer = User.query.filter_by(email="producer@test.local").first()
        artist = User.query.filter_by(email="artist@test.local").first()

        beat = Beat(
            producer_id=producer.id,
            title="Exclusive Beat",
            genre="Drill",
            mood="Dark",
            bpm=140,
            preview_url="https://example.com/ex-preview.mp3",
            full_url="https://example.com/ex-full.wav",
            is_available=True,
        )
        db.session.add(beat)
        db.session.flush()
        db.session.add(
            BeatLicense(
                beat_id=beat.id,
                type=BeatLicenseType.EXCLUSIVE,
                price=15000,
                terms_json={"usage": "exclusive"},
            )
        )
        db.session.commit()
        beat_id = beat.id
        artist_id = artist.id

    response = client.post(
        f"/beats/{beat_id}/purchase",
        json={
            "artist_id": artist_id,
            "license_type": "EXCLUSIVE",
            "txn_ref": "TXN-EXCLUSIVE-001",
            "amount_paid": 15000,
        },
    )

    assert response.status_code == 201
    assert response.get_json()["beat"]["is_available"] is False

    with app.app_context():
        beat = db.session.get(Beat, beat_id)
        assert beat is not None
        assert beat.is_available is False


def test_purchase_rejects_amount_mismatch(app, client):
    with app.app_context():
        producer = User.query.filter_by(email="producer@test.local").first()
        artist = User.query.filter_by(email="artist@test.local").first()

        beat = Beat(
            producer_id=producer.id,
            title="Price Locked Beat",
            genre="Trap",
            mood="Aggressive",
            bpm=145,
            preview_url="https://example.com/price-preview.mp3",
            full_url="https://example.com/price-full.wav",
            is_available=True,
        )
        db.session.add(beat)
        db.session.flush()
        db.session.add(
            BeatLicense(
                beat_id=beat.id,
                type=BeatLicenseType.BASIC,
                price=3000,
                terms_json={"usage": "non-exclusive"},
            )
        )
        db.session.commit()
        beat_id = beat.id
        artist_id = artist.id

    response = client.post(
        f"/beats/{beat_id}/purchase",
        json={
            "artist_id": artist_id,
            "license_type": "BASIC",
            "txn_ref": "TXN-PRICE-MISMATCH-001",
            "amount_paid": 2500,
        },
    )

    assert response.status_code == 400
    body = response.get_json()
    assert "must match license price" in body["error"]


def test_purchase_rejects_duplicate_artist_license_ownership(app, client):
    with app.app_context():
        producer = User.query.filter_by(email="producer@test.local").first()
        artist = User.query.filter_by(email="artist@test.local").first()

        beat = Beat(
            producer_id=producer.id,
            title="Duplicate Guard Beat",
            genre="HipHop",
            mood="Chill",
            bpm=92,
            preview_url="https://example.com/dup-preview.mp3",
            full_url="https://example.com/dup-full.wav",
            is_available=True,
        )
        db.session.add(beat)
        db.session.flush()
        db.session.add(
            BeatLicense(
                beat_id=beat.id,
                type=BeatLicenseType.PREMIUM,
                price=5000,
                terms_json={"usage": "premium"},
            )
        )
        db.session.commit()
        beat_id = beat.id
        artist_id = artist.id

    first = client.post(
        f"/beats/{beat_id}/purchase",
        json={
            "artist_id": artist_id,
            "license_type": "PREMIUM",
            "txn_ref": "TXN-DUP-001",
            "amount_paid": 5000,
        },
    )
    assert first.status_code == 201

    second = client.post(
        f"/beats/{beat_id}/purchase",
        json={
            "artist_id": artist_id,
            "license_type": "PREMIUM",
            "txn_ref": "TXN-DUP-002",
            "amount_paid": 5000,
        },
    )
    assert second.status_code == 409
    assert "already owns this beat" in second.get_json()["error"]


def test_mpesa_callback_updates_payment_status(app, client):
    with app.app_context():
        artist = User.query.filter_by(email="artist@test.local").first()

    init_response = client.post(
        "/payments/mpesa/stk-push",
        json={
            "user_id": artist.id,
            "amount": 1500,
            "txn_ref": "TXN-12345",
        },
    )
    assert init_response.status_code == 202

    callback_response = client.post(
        "/payments/mpesa/callback",
        json={"txn_ref": "TXN-12345", "status": "CONFIRMED"},
    )
    assert callback_response.status_code == 200
    assert callback_response.get_json()["payment"]["status"] == "CONFIRMED"
    assert callback_response.get_json()["payment"]["created_at"].endswith("Z")

    with app.app_context():
        payment = Payment.query.filter_by(txn_ref="TXN-12345").first()
        assert payment is not None
        assert payment.status == PaymentStatus.CONFIRMED


def test_payment_history_returns_utc_z_timestamps(app, client):
    with app.app_context():
        artist = User.query.filter_by(email="artist@test.local").first()

    init_response = client.post(
        "/payments/mpesa/stk-push",
        json={
            "user_id": artist.id,
            "amount": 1800,
            "txn_ref": "TXN-HISTORY-001",
        },
    )
    assert init_response.status_code == 202
    assert init_response.get_json()["created_at"].endswith("Z")

    history = client.get(f"/payments/history?user_id={artist.id}")
    assert history.status_code == 200
    rows = history.get_json()
    assert len(rows) >= 1
    assert rows[0]["created_at"].endswith("Z")
