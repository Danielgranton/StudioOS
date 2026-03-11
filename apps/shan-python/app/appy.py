import requests
from flask import request, jsonify, Blueprint, render_template, current_app

app = Blueprint('app', __name__)
pending_checkout_refs = {}


def _metadata_to_dict(items):
    metadata = {}
    for item in items or []:
        name = item.get("Name")
        if not name:
            continue
        metadata[name] = item.get("Value")
    return metadata


def _to_positive_int(value, fallback=None):
    try:
        parsed = int(value)
        if parsed > 0:
            return parsed
    except (TypeError, ValueError):
        pass
    return fallback


def _resolve_beat_amount(beat_id, license_id):
    if not beat_id or not license_id:
        return None

    nest_base_url = current_app.config.get("NEST_API_BASE_URL", "http://localhost:3000").rstrip("/")
    try:
        response = requests.get(f"{nest_base_url}/beats/{beat_id}/licenses", timeout=10)
    except requests.RequestException as exc:
        current_app.logger.error("Failed to fetch beat licenses from Nest: %s", exc)
        return None

    if not response.ok:
        current_app.logger.error("Failed to fetch beat licenses. status=%s body=%s", response.status_code, response.text)
        return None

    try:
        licenses = response.json()
    except ValueError:
        current_app.logger.error("Invalid JSON while fetching beat licenses")
        return None

    match = next((item for item in licenses if str(item.get("id")) == str(license_id)), None)
    if not match:
        return None

    return _to_positive_int(match.get("price"))


@app.route("/stk_push", methods=["POST"])
def stk_push():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    if not phone:
        return jsonify({"error": "phone is required"}), 400

    payment_type = data.get("type", "project_booking")
    booking_ref = data.get("booking_ref")
    beat_id = data.get("beat_id")
    license_id = data.get("license_id")
    phase = data.get("phase", "deposit")
    total_amount = _to_positive_int(data.get("total_amount"))

    # Resolve charge amount by payment type.
    amount = None
    if payment_type == "beat_purchase":
        amount = _resolve_beat_amount(beat_id, license_id)
        if amount is None:
            return jsonify({"error": "Unable to resolve beat price. Provide valid beat_id and license_id"}), 400
    elif payment_type == "session_booking":
        if not booking_ref:
            return jsonify({"error": "booking_ref is required for session_booking"}), 400
        if not total_amount:
            return jsonify({"error": "total_amount is required for session_booking"}), 400

        deposit_amount = (total_amount + 1) // 2
        amount = deposit_amount if phase == "deposit" else total_amount - deposit_amount
        if amount <= 0:
            return jsonify({"error": "computed amount must be positive"}), 400
    else:
        amount = _to_positive_int(data.get("amount"))
        if not amount:
            return jsonify({"error": "amount is required"}), 400

    account_reference = data.get("account_reference", booking_ref or "Payment")
    transaction_description = data.get("transaction_description", "Rent Payment")

    response = current_app.mpesa_api.initiate_stk_push(
        phone,
        amount,
        account_reference,
        transaction_description,
    )

    if response:
        pending_checkout_refs[response] = {
            "type": payment_type,
            "booking_ref": booking_ref,
            "beat_id": beat_id,
            "license_id": license_id,
            "phase": phase,
            "total_amount": total_amount,
            "amount": amount,
        }

    return (
        jsonify(
            {
                "checkout_request_id": response,
                "booking_ref": booking_ref,
                "type": payment_type,
                "amount": amount,
                "phase": phase if payment_type == "session_booking" else None,
            }
        ),
        (200 if response else 400),
    )


@app.route("/mpesa/callback", methods=["POST"])
def mpesa_callback():
    payload = request.get_json(silent=True) or {}
    callback_body = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = callback_body.get("CheckoutRequestID")
    result_code = callback_body.get("ResultCode")
    result_desc = callback_body.get("ResultDesc")
    metadata_items = callback_body.get("CallbackMetadata", {}).get("Item", [])
    metadata = _metadata_to_dict(metadata_items)

    context = pending_checkout_refs.get(checkout_request_id, {})
    booking_ref = metadata.get("AccountReference") or context.get("booking_ref")
    payment_ref = metadata.get("MpesaReceiptNumber") or checkout_request_id
    is_full_payment = str(result_code) == "0"
    payment_type = context.get("type", "project_booking")
    phase = context.get("phase", "deposit")
    total_amount = context.get("total_amount")

    if payment_type != "beat_purchase" and not booking_ref:
        current_app.logger.warning(
            "Ignoring callback without booking_ref. checkout_request_id=%s result_code=%s",
            checkout_request_id,
            result_code,
        )
        return jsonify({"status": "ignored", "reason": "missing booking_ref"}), 202

    if payment_type == "beat_purchase":
        webhook_payload = {
            "type": "beat_purchase",
            "paymentRef": payment_ref,
            "checkoutRequestId": checkout_request_id,
            "resultCode": result_code,
            "resultDesc": result_desc,
            "isFullPayment": is_full_payment,
            "beatId": context.get("beat_id"),
            "licenseId": context.get("license_id"),
        }
    elif payment_type == "session_booking":
        webhook_payload = {
            "type": "session_booking",
            "bookingRef": booking_ref,
            "paymentRef": payment_ref,
            "totalAmount": total_amount,
            "phase": phase,
            "isFullPayment": is_full_payment,
            "checkoutRequestId": checkout_request_id,
            "resultCode": result_code,
            "resultDesc": result_desc,
        }
    else:
        webhook_payload = {
            "bookingRef": booking_ref,
            "isFullPayment": is_full_payment,
            "paymentRef": payment_ref,
            "checkoutRequestId": checkout_request_id,
            "resultCode": result_code,
            "resultDesc": result_desc,
        }

    headers = {"Content-Type": "application/json"}
    webhook_secret = current_app.config.get("NEST_WEBHOOK_SECRET")
    if webhook_secret:
        headers["x-webhook-secret"] = webhook_secret

    webhook_url = current_app.config["NEST_PAYMENT_WEBHOOK_URL"]
    try:
        webhook_response = requests.post(
            webhook_url,
            json=webhook_payload,
            headers=headers,
            timeout=10,
        )
        if webhook_response.ok:
            pending_checkout_refs.pop(checkout_request_id, None)
            return jsonify({"status": "forwarded", "booking_ref": booking_ref, "type": payment_type}), 200

        current_app.logger.error(
            "Nest webhook failed. status=%s body=%s",
            webhook_response.status_code,
            webhook_response.text,
        )
        return jsonify({"status": "forward_failed"}), 502
    except requests.RequestException as exc:
        current_app.logger.error("Failed to reach Nest webhook: %s", exc)
        return jsonify({"status": "forward_error"}), 502

@app.route("/")
def payment():
    return render_template("payment.html")


@app.route("/health/mpesa", methods=["GET"])
def mpesa_health():
    token_ready = current_app.mpesa_api.ensure_valid_token()
    status_code = 200 if token_ready else 503
    return jsonify({"mpesa_ready": bool(token_ready)}), status_code
