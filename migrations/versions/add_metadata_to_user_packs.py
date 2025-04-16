"""add metadata to user_packs

Revision ID: add_metadata_to_user_packs
Revises: b0aac08ce9c2
Create Date: 2025-04-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_metadata_to_user_packs'
down_revision = 'b0aac08ce9c2'
branch_labels = None
depends_on = None


def upgrade():
    # Add metadata JSON column to user_packs table
    op.add_column('user_packs', sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Remove metadata column from user_packs table
    op.drop_column('user_packs', 'metadata')