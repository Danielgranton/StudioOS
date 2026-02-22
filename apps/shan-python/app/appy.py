from flask import request, jsonify, Blueprint, render_template, current_app

app = Blueprint('app', __name__)


@app.route("/stk_push", methods=["POST"])
def stk_push():
    data = request.get_json()
    phone = data["phone"]
    amount = data["amount"]
    account_reference = data.get("account_reference", "Payment")
    transaction_description = data.get("transaction_description", "Rent Payment")

    response = current_app.mpesa_api.initiate_stk_push(
        phone,
        amount,
        account_reference,
        transaction_description,
    )

    return jsonify({"checkout_request_id": response}), (200 if response else 400)

@app.route("/")
def payment():
    return render_template("payment.html")


@app.route("/health/mpesa", methods=["GET"])
def mpesa_health():
    token_ready = current_app.mpesa_api.ensure_valid_token()
    status_code = 200 if token_ready else 503
    return jsonify({"mpesa_ready": bool(token_ready)}), status_code