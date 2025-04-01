from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
# Import db instance from the main app file
from server.app import db

class Collection(db.Model):
    __tablename__ = 'collections'
    # Define composite primary key below in __table_args__

    # Foreign Keys forming the composite primary key
    patron_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True, nullable=False)
    artwork_id = db.Column(db.Integer, db.ForeignKey('artworks.artwork_id'), primary_key=True, nullable=False)

    acquired_at = db.Column(db.TIMESTAMP, nullable=False, default=datetime.utcnow)
    transaction_id = db.Column(db.String(255), unique=True, nullable=True) # Unique constraint on nullable might vary by DB

    # --- Relationships ---
    # Relationship back to the User (Patron)
    patron = db.relationship('User', back_populates='collections')
    # Relationship back to the Artwork
    artwork = db.relationship('Artwork', back_populates='collections')


    serialize_rules = (
        'patron.(user_id, username)', # Include specific fields from patron
        'artwork',                    # Include the full artwork object (uses Artwork's rules)
    )

    def __repr__(self):
        return f'<Collection Patron {self.patron_id} - Artwork {self.artwork_id}>'



    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Composite primary key already defined by setting primary_key=True on columns
        # Indexes for faster lookups
        db.Index('idx_collections_patron_id', 'patron_id'), # Useful even with PK for single-column lookups
        db.Index('idx_collections_artwork_id', 'artwork_id'),
        db.Index('idx_collections_acquired_at', 'acquired_at'),
        # Note: Partitioning is a DB-level implementation detail, not defined directly in SQLAlchemy model args usually.
        # You would apply partitioning commands directly to the DB *after* the table is created by migrations.
    )