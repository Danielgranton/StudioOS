from flask import Blueprint, jsonify

marketplace_bp = Blueprint("marketplace", __name__)


@marketplace_bp.get("/beats")
def list_beats():
    return jsonify({"message": "marketplace beats stub", "items": []})
