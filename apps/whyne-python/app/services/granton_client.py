from __future__ import annotations

from typing import Any

import requests
from flask import current_app


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    secret = current_app.config.get("GRANTON_SERVICE_SECRET")
    if secret:
        headers["x-service-secret"] = secret
    return headers


def validate_user_role(user_id: int, role: str) -> bool:
    if not current_app.config.get("VALIDATE_REMOTE_USERS", True):
        return True

    base_url = current_app.config["GRANTON_BASE_URL"].rstrip("/")
    response = requests.get(
        f"{base_url}/auth/users/{user_id}",
        params={"role": role},
        headers=_headers(),
        timeout=current_app.config["GRANTON_TIMEOUT_SECONDS"],
    )
    response.raise_for_status()
    data = response.json()
    return bool(data.get("exists"))


def create_project_from_booking(payload: dict[str, Any]) -> dict[str, Any]:
    base_url = current_app.config["GRANTON_BASE_URL"].rstrip("/")
    response = requests.post(
        f"{base_url}/projects/from-booking",
        json=payload,
        headers=_headers(),
        timeout=current_app.config["GRANTON_TIMEOUT_SECONDS"],
    )
    response.raise_for_status()
    return response.json()
