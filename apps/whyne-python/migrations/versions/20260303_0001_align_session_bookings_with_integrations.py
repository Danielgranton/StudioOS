"""Align session_bookings schema with granton/shan integrations.

Revision ID: 20260303_0001
Revises:
Create Date: 2026-03-03 16:30:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260303_0001"
down_revision = None
branch_labels = None
depends_on = None


payment_status_enum = sa.Enum(
    "BOOKED",
    "FULLY_PAID",
    name="bookingpaymentstatus",
    native_enum=False,
    validate_strings=True,
)


def _drop_legacy_user_fks_if_postgres() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE session_bookings DROP CONSTRAINT IF EXISTS session_bookings_artist_id_fkey"
        )
        op.execute(
            "ALTER TABLE session_bookings DROP CONSTRAINT IF EXISTS session_bookings_producer_id_fkey"
        )


def _add_legacy_user_fks_if_postgres() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE session_bookings "
            "ADD CONSTRAINT session_bookings_artist_id_fkey "
            "FOREIGN KEY (artist_id) REFERENCES users (id)"
        )
        op.execute(
            "ALTER TABLE session_bookings "
            "ADD CONSTRAINT session_bookings_producer_id_fkey "
            "FOREIGN KEY (producer_id) REFERENCES users (id)"
        )


def upgrade() -> None:
    _drop_legacy_user_fks_if_postgres()

    with op.batch_alter_table("session_bookings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("studio_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("project_title", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("booking_ref", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("payment_ref", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("payment_status", payment_status_enum, nullable=True))

    op.execute("UPDATE session_bookings SET studio_id = 'unknown-studio' WHERE studio_id IS NULL")
    op.execute("UPDATE session_bookings SET project_title = 'Legacy Session' WHERE project_title IS NULL")
    op.execute(
        "UPDATE session_bookings SET booking_ref = 'LEGACY-' || id WHERE booking_ref IS NULL"
    )
    op.execute("UPDATE session_bookings SET payment_status = 'BOOKED' WHERE payment_status IS NULL")

    with op.batch_alter_table("session_bookings", schema=None) as batch_op:
        batch_op.alter_column("studio_id", existing_type=sa.String(length=255), nullable=False)
        batch_op.alter_column("project_title", existing_type=sa.String(length=255), nullable=False)
        batch_op.alter_column("booking_ref", existing_type=sa.String(length=64), nullable=False)
        batch_op.alter_column(
            "payment_status", existing_type=payment_status_enum, nullable=False
        )
        batch_op.create_unique_constraint("uq_session_bookings_booking_ref", ["booking_ref"])


def downgrade() -> None:
    with op.batch_alter_table("session_bookings", schema=None) as batch_op:
        batch_op.drop_constraint("uq_session_bookings_booking_ref", type_="unique")
        batch_op.drop_column("payment_status")
        batch_op.drop_column("payment_ref")
        batch_op.drop_column("project_id")
        batch_op.drop_column("booking_ref")
        batch_op.drop_column("project_title")
        batch_op.drop_column("studio_id")

    _add_legacy_user_fks_if_postgres()

