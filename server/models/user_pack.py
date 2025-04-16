from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
from server.app import db

class UserPack(db.Model, SerializerMixin):
    __tablename__ = 'user_packs'

    user_pack_id = db.Column(db.Integer, primary_key=True)
    # Foreign Key to the User who owns this pack instance
    # Ensure this matches the primary key column name in your User model ('user_id')
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    # Foreign Key to the PackType defining what kind of pack this is
    pack_type_id = db.Column(db.Integer, db.ForeignKey('pack_types.pack_type_id'), nullable=False)
    # JSON metadata for pack-specific data (like artist_id for artist packs)
    pack_metadata = db.Column(db.JSON, nullable=True)

    acquired_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    # Timestamp when the pack was opened. NULL means it's unopened.
    opened_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # --- Relationships ---
    # Relationship back to the User (owner)
    owner = db.relationship('User', back_populates='packs')
    # Relationship back to the PackType
    pack_type = db.relationship('PackType', back_populates='user_packs')

    # --- Serialization ---
    serialize_rules = (
        '-owner', # Avoid circular refs / large data by default
        'pack_type.pack_type_id', # Include pack type ID
        'pack_type.name',       # Include pack type name
        'pack_type.description', # Include pack type description
    )

    def __repr__(self):
        status = "Opened" if self.opened_at else "Unopened"
        return f'<UserPack {self.user_pack_id}: Type {self.pack_type_id} for User {self.user_id} ({status})>'

    # --- Table Args ---
    __table_args__ = (
        db.Index('idx_user_packs_user_id', 'user_id'),
        db.Index('idx_user_packs_pack_type_id', 'pack_type_id'),
        # Index to quickly find unopened packs for a user
        db.Index('idx_user_packs_user_opened', 'user_id', 'opened_at'),
    )