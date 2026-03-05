from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    return jsonify({"message": "register stub", "payload": payload}), 201


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    return jsonify({"message": "login stub", "payload": payload})
