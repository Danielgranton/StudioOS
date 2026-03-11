from __future__ import annotations

import requests
from flask import current_app


def request_stk_push(*, phone: str, amount: int, booking_ref: str) -> dict:
    base_url = current_app.config["SHAN_BASE_URL"].rstrip("/")
    payload = {
        "phone": phone,
        "amount": amount,
        "booking_ref": booking_ref,
    }
    response = requests.post(
        f"{base_url}/stk_push",
        json=payload,
        timeout=current_app.config["SHAN_TIMEOUT_SECONDS"],
    )
    response.raise_for_status()
    return response.json()
