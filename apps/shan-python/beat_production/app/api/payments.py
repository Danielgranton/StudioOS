from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.beat import Beat
from app.models.payment import Payment, PaymentProvider, PaymentStatus
from app.models.project import Project
from app.models.user import User
from app.services.payment_service import build_mpesa_stk_payload
from app.utils.datetime import to_utc_iso_z

payments_bp = Blueprint("payments", __name__)


@payments_bp.get("/history")
def payment_history():
    user_id = request.args.get("user_id", type=int)

    query = Payment.query
    if user_id is not None:
        query = query.filter(Payment.user_id == user_id)

    payments = query.order_by(Payment.created_at.desc()).all()
    return jsonify([_payment_to_dict(payment) for payment in payments])


@payments_bp.post("/mpesa/stk-push")
def stk_push():
    payload = request.get_json(silent=True) or {}
    required = ["user_id", "amount", "txn_ref"]
    missing = [field for field in required if payload.get(field) in [None, ""]]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    user = db.session.get(User, payload["user_id"])
    if not user:
        return jsonify({"error": "user_id not found"}), 404

    if payload.get("project_id") and not db.session.get(Project, payload["project_id"]):
        return jsonify({"error": "project_id not found"}), 404
    if payload.get("beat_id") and not db.session.get(Beat, payload["beat_id"]):
        return jsonify({"error": "beat_id not found"}), 404

    try:
        amount = Decimal(str(payload["amount"]))
    except InvalidOperation:
        return jsonify({"error": "amount must be numeric"}), 400

    payment = Payment.query.filter_by(txn_ref=payload["txn_ref"]).first()
    if not payment:
        payment = Payment(
            user_id=payload["user_id"],
            project_id=payload.get("project_id"),
            beat_id=payload.get("beat_id"),
            provider=PaymentProvider.MPESA,
            txn_ref=payload["txn_ref"],
            amount=amount,
            status=PaymentStatus.PENDING,
        )
        db.session.add(payment)
        db.session.commit()

    response = build_mpesa_stk_payload(payload)
    response["payment_id"] = payment.id
    response["txn_ref"] = payment.txn_ref
    response["created_at"] = to_utc_iso_z(payment.created_at)
    return jsonify(response), 202


@payments_bp.post("/mpesa/callback")
def mpesa_callback():
    payload = request.get_json(silent=True) or {}
    txn_ref = payload.get("txn_ref")
    if not txn_ref:
        return jsonify({"error": "txn_ref is required"}), 400

    payment = Payment.query.filter_by(txn_ref=txn_ref).first()
    if not payment:
        return jsonify({"error": "Payment not found"}), 404

    status_value = payload.get("status", PaymentStatus.FAILED.value)
    try:
        payment.status = PaymentStatus(status_value)
    except ValueError:
        return jsonify({"error": "Invalid payment status"}), 400

    db.session.commit()
    return (
        jsonify(
            {
                "message": "callback processed",
                "payment": {
                    "id": payment.id,
                    "txn_ref": payment.txn_ref,
                    "status": payment.status.value,
                    "amount": float(payment.amount),
                    "created_at": to_utc_iso_z(payment.created_at),
                },
            }
        ),
        200,
    )


def _payment_to_dict(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "user_id": payment.user_id,
        "project_id": payment.project_id,
        "beat_id": payment.beat_id,
        "provider": payment.provider.value,
        "txn_ref": payment.txn_ref,
        "amount": float(payment.amount),
        "status": payment.status.value,
        "created_at": to_utc_iso_z(payment.created_at),
    }
