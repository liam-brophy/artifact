"""add_border_decal_id_to_artworks

Revision ID: 30715865c613
Revises: 6ee0423900e0
Create Date: 2025-04-14 13:33:01.974223
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "88c67a0dfd78"
down_revision = "6ee0423900e0"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("artworks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("border_decal_id", sa.String(length=100), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("artworks", schema=None) as batch_op:
        batch_op.drop_column("border_decal_id")

    # ### end Alembic commands ###

