"""initial schema

Revision ID: 20260305_0001
Revises: 
Create Date: 2026-03-05 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role_enum = sa.Enum("ARTIST", "PRODUCER", "OWNER", name="userrole")
project_status_enum = sa.Enum(
    "RECORDING",
    "MIXING",
    "REVIEW",
    "PAYMENT",
    "RELEASE",
    "STREAMING",
    "ANALYTICS",
    name="projectstatus",
)
license_type_enum = sa.Enum("BASIC", "PREMIUM", "EXCLUSIVE", name="beatlicensetype")
payment_provider_enum = sa.Enum("MPESA", name="paymentprovider")
payment_status_enum = sa.Enum("PENDING", "CONFIRMED", "FAILED", name="paymentstatus")
asset_type_enum = sa.Enum("BEAT", "PROJECT_FILE", name="assettype")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=False, unique=True),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "studios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("artist_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("producer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("studio_id", sa.Integer(), sa.ForeignKey("studios.id"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("status", project_status_enum, nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("eta_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deposit_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("deposit_paid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("balance_due", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "beats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("producer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("genre", sa.String(length=60), nullable=False),
        sa.Column("mood", sa.String(length=60), nullable=True),
        sa.Column("bpm", sa.Integer(), nullable=False),
        sa.Column("preview_url", sa.String(length=255), nullable=False),
        sa.Column("full_url", sa.String(length=255), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "beat_licenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("beat_id", sa.Integer(), sa.ForeignKey("beats.id"), nullable=False),
        sa.Column("type", license_type_enum, nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("terms_json", sa.JSON(), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("beat_id", sa.Integer(), sa.ForeignKey("beats.id"), nullable=True),
        sa.Column("provider", payment_provider_enum, nullable=False),
        sa.Column("txn_ref", sa.String(length=120), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", payment_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "beat_purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("beat_id", sa.Integer(), sa.ForeignKey("beats.id"), nullable=False),
        sa.Column("artist_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("license_type", license_type_enum, nullable=False),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False),
        sa.Column("transaction_id", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "asset_access",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_type", asset_type_enum, nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("can_download", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("asset_access")
    op.drop_table("beat_purchases")
    op.drop_table("payments")
    op.drop_table("beat_licenses")
    op.drop_table("beats")
    op.drop_table("projects")
    op.drop_table("studios")
    op.drop_table("users")

    asset_type_enum.drop(op.get_bind(), checkfirst=True)
    payment_status_enum.drop(op.get_bind(), checkfirst=True)
    payment_provider_enum.drop(op.get_bind(), checkfirst=True)
    license_type_enum.drop(op.get_bind(), checkfirst=True)
    project_status_enum.drop(op.get_bind(), checkfirst=True)
    user_role_enum.drop(op.get_bind(), checkfirst=True)
