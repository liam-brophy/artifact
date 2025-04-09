from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy import ForeignKey, Integer, String, Column, TIMESTAMP, Index # Added Column
# Import db instance from the main app file
from server.app import db

class Collection(db.Model, SerializerMixin):
    __tablename__ = 'collections'

    # Foreign Keys forming the composite primary key
    # --- ADDED ondelete='CASCADE' to both ForeignKeys ---
    patron_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True, nullable=False)
    artwork_id = Column(Integer, ForeignKey('artworks.artwork_id', ondelete='CASCADE'), primary_key=True, nullable=False)

    acquired_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    transaction_id = Column(String(255), unique=True, nullable=True) # Optional

    # --- Relationships ---
    # Relationship back to the User (Patron)
    patron = db.relationship('User', back_populates='collections')
    # Relationship back to the Artwork
    artwork = db.relationship('Artwork', back_populates='collections')

    # --- Serialization ---
    serialize_rules = (
        # Include specific fields from patron
        'patron.user_id',
        'patron.username',
        # Include the full artwork object (uses Artwork's rules)
        # Careful: Artwork serialization includes artist details. Avoid deep nesting.
        'artwork',
        # Exclude the direct relationships themselves if artwork/patron info is included above
        '-patron',
        '-artwork',
    )

    def __repr__(self):
        return f'<Collection Patron {self.patron_id} - Artwork {self.artwork_id}>'

    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Indexes for faster lookups
        Index('idx_collections_patron_id', 'patron_id'),
        Index('idx_collections_artwork_id', 'artwork_id'),
        Index('idx_collections_acquired_at', 'acquired_at'),
    )