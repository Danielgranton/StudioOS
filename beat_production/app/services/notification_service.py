def send_deadline_reminder(user_id: int, message: str) -> dict:
    return {"sent": True, "user_id": user_id, "message": message}
