from datetime import datetime

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.project import Project, ProjectStatus
from app.models.studio import Studio
from app.models.user import User
from app.services.lifecycle_service import can_transition
from app.utils.datetime import to_utc_iso_z

projects_bp = Blueprint("projects", __name__)


@projects_bp.post("")
def create_project():
    payload = request.get_json(silent=True) or {}
    required = ["artist_id", "producer_id", "studio_id", "title"]
    missing = [field for field in required if payload.get(field) is None]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    artist = db.session.get(User, payload["artist_id"])
    producer = db.session.get(User, payload["producer_id"])
    studio = db.session.get(Studio, payload["studio_id"])
    if not artist or not producer or not studio:
        return jsonify({"error": "artist_id, producer_id, or studio_id not found"}), 404

    status_value = payload.get("status", ProjectStatus.RECORDING.value)
    try:
        status = ProjectStatus(status_value)
    except ValueError:
        return jsonify({"error": "Invalid project status"}), 400

    eta_date = None
    if payload.get("eta_date"):
        try:
            eta_date = datetime.fromisoformat(payload["eta_date"])
        except ValueError:
            return jsonify({"error": "eta_date must be ISO datetime"}), 400

    project = Project(
        artist_id=payload["artist_id"],
        producer_id=payload["producer_id"],
        studio_id=payload["studio_id"],
        title=payload["title"],
        status=status,
        progress=int(payload.get("progress", 0)),
        eta_date=eta_date,
        deposit_required=bool(payload.get("deposit_required", True)),
        deposit_paid=bool(payload.get("deposit_paid", False)),
        balance_due=payload.get("balance_due", 0),
    )
    db.session.add(project)
    db.session.commit()
    return jsonify(_project_to_dict(project)), 201


@projects_bp.get("")
def list_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([_project_to_dict(project) for project in projects])


@projects_bp.get("/<int:project_id>")
def get_project(project_id: int):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(_project_to_dict(project))


@projects_bp.patch("/<int:project_id>/status")
def update_project_status(project_id: int):
    payload = request.get_json(silent=True) or {}
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    to_status = payload.get("to_status")
    if not to_status:
        return jsonify({"error": "to_status is required"}), 400

    if not can_transition(project.status.value, to_status):
        return jsonify({"error": f"Invalid transition: {project.status.value} -> {to_status}"}), 400

    project.status = ProjectStatus(to_status)
    if payload.get("progress") is not None:
        project.progress = int(payload["progress"])
    if payload.get("eta_date"):
        try:
            project.eta_date = datetime.fromisoformat(payload["eta_date"])
        except ValueError:
            return jsonify({"error": "eta_date must be ISO datetime"}), 400

    db.session.commit()
    return jsonify(_project_to_dict(project))


def _project_to_dict(project: Project) -> dict:
    return {
        "id": project.id,
        "artist_id": project.artist_id,
        "producer_id": project.producer_id,
        "studio_id": project.studio_id,
        "title": project.title,
        "status": project.status.value,
        "progress": project.progress,
        "eta_date": to_utc_iso_z(project.eta_date),
        "deposit_required": project.deposit_required,
        "deposit_paid": project.deposit_paid,
        "balance_due": float(project.balance_due),
        "created_at": to_utc_iso_z(project.created_at),
    }
