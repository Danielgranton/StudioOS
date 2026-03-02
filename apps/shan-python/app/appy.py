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


@app.route("/stk_push", methods=["POST"])
def stk_push():
    data = request.get_json()
    phone = data["phone"]
    amount = data["amount"]
    booking_ref = data.get("booking_ref")
    account_reference = data.get("account_reference", booking_ref or "Payment")
    transaction_description = data.get("transaction_description", "Rent Payment")

    response = current_app.mpesa_api.initiate_stk_push(
        phone,
        amount,
        account_reference,
        transaction_description,
    )

    if response and booking_ref:
        pending_checkout_refs[response] = booking_ref

    return jsonify({"checkout_request_id": response, "booking_ref": booking_ref}), (200 if response else 400)


@app.route("/mpesa/callback", methods=["POST"])
def mpesa_callback():
    payload = request.get_json(silent=True) or {}
    callback_body = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = callback_body.get("CheckoutRequestID")
    result_code = callback_body.get("ResultCode")
    result_desc = callback_body.get("ResultDesc")
    metadata_items = callback_body.get("CallbackMetadata", {}).get("Item", [])
    metadata = _metadata_to_dict(metadata_items)

    booking_ref = metadata.get("AccountReference") or pending_checkout_refs.get(checkout_request_id)
    payment_ref = metadata.get("MpesaReceiptNumber") or checkout_request_id
    is_full_payment = str(result_code) == "0"

    if not booking_ref:
        current_app.logger.warning(
            "Ignoring callback without booking_ref. checkout_request_id=%s result_code=%s",
            checkout_request_id,
            result_code,
        )
        return jsonify({"status": "ignored", "reason": "missing booking_ref"}), 202

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
            return jsonify({"status": "forwarded", "booking_ref": booking_ref}), 200

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
