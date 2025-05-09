"""add_trade_model

Revision ID: 485b9e2864a0
Revises: 85a3ef946c2a
Create Date: 2025-04-11 17:40:45.044797

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '485b9e2864a0'
down_revision = '85a3ef946c2a'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('trades',
    sa.Column('trade_id', sa.Integer(), nullable=False),
    sa.Column('initiator_id', sa.Integer(), nullable=False),
    sa.Column('recipient_id', sa.Integer(), nullable=False),
    sa.Column('offered_artwork_id', sa.Integer(), nullable=False),
    sa.Column('requested_artwork_id', sa.Integer(), nullable=False),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('status', sa.Enum('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED', name='tradestatus'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['initiator_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['offered_artwork_id'], ['artworks.artwork_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['recipient_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['requested_artwork_id'], ['artworks.artwork_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('trade_id')
    )
    with op.batch_alter_table('trades', schema=None) as batch_op:
        batch_op.create_index('idx_trades_created_at', ['created_at'], unique=False)
        batch_op.create_index('idx_trades_initiator_id', ['initiator_id'], unique=False)
        batch_op.create_index('idx_trades_recipient_id', ['recipient_id'], unique=False)
        batch_op.create_index('idx_trades_status', ['status'], unique=False)

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('trades', schema=None) as batch_op:
        batch_op.drop_index('idx_trades_status')
        batch_op.drop_index('idx_trades_recipient_id')
        batch_op.drop_index('idx_trades_initiator_id')
        batch_op.drop_index('idx_trades_created_at')

    op.drop_table('trades')
    # ### end Alembic commands ###
