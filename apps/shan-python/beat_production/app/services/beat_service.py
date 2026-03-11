VALID_LICENSES = {"BASIC", "PREMIUM", "EXCLUSIVE"}


def validate_license_purchase(license_type: str | None) -> tuple[bool, str]:
    if not license_type:
        return False, "license_type is required"
    if license_type not in VALID_LICENSES:
        return False, "invalid license_type"
    return True, "ok"
