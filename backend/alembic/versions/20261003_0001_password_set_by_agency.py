"""remember which agency set a student's password

Revision ID: 20261003_0001
Revises: 20261002_0001
Create Date: 2026-10-03 00:00:00
"""

from datetime import timedelta

from alembic import op
import sqlalchemy as sa


revision = "20261003_0001"
down_revision = "20261002_0001"
branch_labels = None
depends_on = None

# An account the agency created is inserted in the same request as the agency
# link — seconds apart. A student who registered on their own and was linked
# later has a much older account.
_SAME_REQUEST = timedelta(minutes=1)


def upgrade() -> None:
    op.add_column("users", sa.Column("password_set_by_agency", sa.String(length=36), nullable=True))

    # Accounts agencies created before this column existed got a random
    # password nobody was ever shown; mark them so the agency can issue one.
    # Only accounts that never signed in, never used Google, and were created
    # together with that agency's link.
    conn = op.get_bind()
    rows = conn.execute(sa.text("""
        SELECT u.id, u.created_at, a.agency_id, a.added_at
        FROM users u
        JOIN agency_students a ON a.user_id = u.id
        JOIN student_profiles p ON p.user_id = u.id
        WHERE p.via_agency = :yes
          AND u.oauth_provider IS NULL
          AND u.refresh_token_hash IS NULL
          AND u.password_hash IS NOT NULL
    """), {"yes": True}).fetchall()
    for user_id, created_at, agency_id, added_at in rows:
        if isinstance(created_at, str):
            from datetime import datetime
            created_at, added_at = datetime.fromisoformat(created_at), datetime.fromisoformat(added_at)
        if abs(added_at - created_at) <= _SAME_REQUEST:
            conn.execute(
                sa.text("UPDATE users SET password_set_by_agency = :agency WHERE id = :id"),
                {"agency": agency_id, "id": user_id},
            )


def downgrade() -> None:
    op.drop_column("users", "password_set_by_agency")
