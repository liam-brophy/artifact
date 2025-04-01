from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
import re

# Import db instance from the main app file
from server.app import db

class Artwork(db.Model):
    __tablename__ = 'artworks'

    artwork_id = db.Column(db.Integer, primary_key=True)
    # Foreign Key to link to the User who created this artwork
    artist_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_available = db.Column(db.Boolean, nullable=False, default=True)
    edition_size = db.Column(db.Integer, nullable=False, default=1)
    edition_number = db.Column(db.Integer, nullable=False, default=1) # Consider if this should be unique per conceptual artwork

    # --- Relationships ---
    # Relationship back to the User (Artist) who created this artwork
    artist = db.relationship('User', back_populates='created_artworks')

    # Relationship to collections (one artwork can be in many collections)
    collections = db.relationship('Collection', back_populates='artwork', lazy='dynamic', cascade='all, delete-orphan')

    serialize_rules = (
        # Rule to include only specific fields from the related 'artist' (User) object
        'artist.(user_id, username)', # Include user_id and username from the artist
        # Exclude the collections relationship by default
        '-collections',
    )



    def __repr__(self):
        return f'<Artwork {self.artwork_id}: {self.title}>'

    # --- Static Validation Methods ---
    @staticmethod
    def validate_title(title):
        if not (title and 1 <= len(title) <= 255):
            return False, "Title is required and must be between 1 and 255 characters."
        return True, ""

    @staticmethod
    def validate_url(url, field_name="URL"):
        # Basic URL validation (can be more sophisticated)
        if not url:
             return False, f"{field_name} is required."
        if len(url) > 500:
            return False, f"{field_name} exceeds maximum length of 500 characters."
        if not (url.startswith('http://') or url.startswith('https://')):
            return False, f"{field_name} must be a valid URL (starting with http:// or https://)."
        return True, ""

    @staticmethod
    def validate_edition_size(size):
        if not isinstance(size, int) or size < 1:
            return False, "Edition size must be a positive integer (at least 1)."
        return True, ""

    # Add validation for edition_number if needed, potentially ensuring it's <= edition_size



    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Index on artist_id for faster lookup of artworks by artist
        db.Index('idx_artworks_artist_id', 'artist_id'),
        # Index for sorting/filtering
        db.Index('idx_artworks_created_at', 'created_at'),
        db.Index('idx_artworks_is_available', 'is_available'),
        # Potentially add a unique constraint on (title, artist_id, edition_number)
        # if that combination should be unique, depends on requirements.
        # db.UniqueConstraint('title', 'artist_id', 'edition_number', name='uq_artwork_edition'),
    )