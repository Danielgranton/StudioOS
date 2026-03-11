from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.beat import Beat
from app.models.beat_license import BeatLicense
from app.models.payment import Payment, PaymentProvider, PaymentStatus
from app.models.purchase import BeatLicenseType, BeatPurchase
from app.models.asset_access import AssetAccess, AssetType
from app.models.user import User
from app.services.beat_service import validate_license_purchase
from app.utils.datetime import to_utc_iso_z

beats_bp = Blueprint("beats", __name__)


@beats_bp.post("")
def create_beat():
    payload = request.get_json(silent=True) or {}
    required = ["producer_id", "title", "genre", "bpm", "preview_url", "full_url"]
    missing = [field for field in required if payload.get(field) is None]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    producer = db.session.get(User, payload["producer_id"])
    if not producer:
        return jsonify({"error": "producer_id not found"}), 404

    beat = Beat(
        producer_id=payload["producer_id"],
        title=payload["title"],
        genre=payload["genre"],
        mood=payload.get("mood"),
        bpm=int(payload["bpm"]),
        preview_url=payload["preview_url"],
        full_url=payload["full_url"],
        is_available=bool(payload.get("is_available", True)),
    )
    db.session.add(beat)
    db.session.commit()
    return jsonify(_beat_to_dict(beat)), 201


@beats_bp.get("")
def list_beats():
    beats = Beat.query.order_by(Beat.created_at.desc()).all()
    return jsonify([_beat_to_dict(beat) for beat in beats])


@beats_bp.get("/<int:beat_id>")
def get_beat(beat_id: int):
    beat = db.session.get(Beat, beat_id)
    if not beat:
        return jsonify({"error": "Beat not found"}), 404
    return jsonify(_beat_to_dict(beat))


@beats_bp.post("/<int:beat_id>/purchase")
def purchase_beat(beat_id: int):
    payload = request.get_json(silent=True) or {}
    beat = db.session.get(Beat, beat_id)
    if not beat:
        return jsonify({"error": "Beat not found"}), 404

    valid, reason = validate_license_purchase(payload.get("license_type"))
    if not valid:
        return jsonify({"error": reason}), 400

    artist_id = payload.get("artist_id")
    txn_ref = payload.get("txn_ref")
    if not artist_id or not txn_ref:
        return jsonify({"error": "artist_id and txn_ref are required"}), 400

    artist = db.session.get(User, artist_id)
    if not artist:
        return jsonify({"error": "artist_id not found"}), 404

    try:
        license_type = BeatLicenseType(payload["license_type"])
    except ValueError:
        return jsonify({"error": "invalid license_type"}), 400

    license_row = BeatLicense.query.filter_by(beat_id=beat.id, type=license_type).first()
    if not license_row:
        return jsonify({"error": "License not configured for this beat"}), 400

    existing_ownership = BeatPurchase.query.filter_by(
        beat_id=beat.id,
        artist_id=artist.id,
        license_type=license_type,
    ).first()
    if existing_ownership:
        return (
            jsonify(
                {
                    "error": "Artist already owns this beat for the selected license",
                    "purchase_id": existing_ownership.id,
                }
            ),
            409,
        )

    if not beat.is_available and license_type == BeatLicenseType.EXCLUSIVE:
        return jsonify({"error": "Beat is not available for exclusive purchase"}), 400

    if not beat.is_available and license_type in {BeatLicenseType.BASIC, BeatLicenseType.PREMIUM}:
        return jsonify({"error": "Beat is not currently available"}), 400

    try:
        amount_paid = Decimal(str(payload.get("amount_paid", license_row.price)))
    except InvalidOperation:
        return jsonify({"error": "amount_paid must be numeric"}), 400

    if amount_paid <= 0:
        return jsonify({"error": "amount_paid must be greater than zero"}), 400

    expected_amount = Decimal(str(license_row.price)).quantize(Decimal("0.01"))
    provided_amount = amount_paid.quantize(Decimal("0.01"))
    if provided_amount != expected_amount:
        return (
            jsonify(
                {
                    "error": "amount_paid must match license price",
                    "expected": float(expected_amount),
                    "provided": float(provided_amount),
                }
            ),
            400,
        )

    purchase = BeatPurchase.query.filter_by(transaction_id=txn_ref).first()
    if purchase:
        return jsonify({"message": "purchase already recorded", "purchase_id": purchase.id}), 200

    payment = Payment.query.filter_by(txn_ref=txn_ref).first()
    if not payment:
        payment = Payment(
            user_id=artist.id,
            beat_id=beat.id,
            provider=PaymentProvider.MPESA,
            txn_ref=txn_ref,
            amount=amount_paid,
            status=PaymentStatus.CONFIRMED,
        )
        db.session.add(payment)
    else:
        payment.status = PaymentStatus.CONFIRMED
        payment.beat_id = beat.id
        payment.user_id = artist.id
        payment.amount = amount_paid

    purchase = BeatPurchase(
        beat_id=beat.id,
        artist_id=artist.id,
        license_type=license_type,
        amount_paid=amount_paid,
        transaction_id=txn_ref,
    )
    db.session.add(purchase)

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
            expires_at=None,
        )
        db.session.add(access)
    else:
        access.can_download = True
        access.expires_at = None

    if license_type == BeatLicenseType.EXCLUSIVE:
        beat.is_available = False

    db.session.commit()

    return jsonify(
        {
            "message": "purchase completed",
            "purchase": {
                "id": purchase.id,
                "beat_id": purchase.beat_id,
                "artist_id": purchase.artist_id,
                "license_type": purchase.license_type.value,
                "amount_paid": float(purchase.amount_paid),
                "transaction_id": purchase.transaction_id,
            },
            "payment": {
                "txn_ref": payment.txn_ref,
                "status": payment.status.value,
                "amount": float(payment.amount),
            },
            "asset_access": {
                "user_id": access.user_id,
                "asset_type": access.asset_type.value,
                "asset_id": access.asset_id,
                "can_download": access.can_download,
            },
            "beat": {
                "id": beat.id,
                "is_available": beat.is_available,
            },
        }
    ), 201


def _beat_to_dict(beat: Beat) -> dict:
    return {
        "id": beat.id,
        "producer_id": beat.producer_id,
        "title": beat.title,
        "genre": beat.genre,
        "mood": beat.mood,
        "bpm": beat.bpm,
        "preview_url": beat.preview_url,
        "full_url": beat.full_url,
        "is_available": beat.is_available,
        "created_at": to_utc_iso_z(beat.created_at),
    }
