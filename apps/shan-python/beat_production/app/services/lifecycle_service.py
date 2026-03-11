ALLOWED_TRANSITIONS = {
    "RECORDING": {"MIXING"},
    "MIXING": {"REVIEW"},
    "REVIEW": {"PAYMENT"},
    "PAYMENT": {"RELEASE"},
    "RELEASE": {"STREAMING"},
    "STREAMING": {"ANALYTICS"},
    "ANALYTICS": set(),
}


def can_transition(from_status: str | None, to_status: str | None) -> bool:
    if not from_status or not to_status:
        return False
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())
