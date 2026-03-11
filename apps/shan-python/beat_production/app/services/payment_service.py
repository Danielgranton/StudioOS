def build_mpesa_stk_payload(payload: dict) -> dict:
    return {
        "provider": "MPESA",
        "status": "PENDING",
        "phone": payload.get("phone"),
        "amount": payload.get("amount"),
        "account_reference": payload.get("account_reference", "StudioOS"),
    }
