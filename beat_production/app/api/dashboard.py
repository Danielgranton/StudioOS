from flask import Blueprint, jsonify

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/artist")
def artist_dashboard():
    return jsonify({"message": "artist dashboard stub"})


@dashboard_bp.get("/producer")
def producer_dashboard():
    return jsonify({"message": "producer dashboard stub"})
