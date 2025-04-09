"""Change artwork rarity to ENUM and non-nullable

Revision ID: 27491eb3190a
Revises: 4486eed7f744
Create Date: 2025-04-09 12:47:46.424768

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '27491eb3190a'
down_revision = '4486eed7f744'
branch_labels = None
depends_on = None

rarity_enum = sa.Enum('common', 'uncommon', 'rare', 'epic', 'legendary', name='artwork_rarity_enum', create_type=False) 

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute("UPDATE artworks SET rarity = 'common' WHERE rarity IS NULL")
    # You could also choose 'uncommon' or another value if that makes more sense

    # --- Now perform the column alteration ---
    with op.batch_alter_table('artworks', schema=None) as batch_op:
        batch_op.alter_column('rarity',
               existing_type=sa.VARCHAR(length=20),
               type_=rarity_enum,
               existing_nullable=True,
               nullable=False, # This triggers the NOT NULL constraint attempt
               postgresql_using='rarity::artwork_rarity_enum'
               )

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('artworks', schema=None) as batch_op:
        batch_op.alter_column('rarity',
               existing_type=postgresql.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary', name='artwork_rarity_enum'),
               type_=sa.VARCHAR(length=20),
               nullable=True)

    # ### end Alembic commands ###
