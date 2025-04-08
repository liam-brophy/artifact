from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
import re

# Import db instance from the main app file
from server.app import db

class Artwork(db.Model, SerializerMixin):
    __tablename__ = 'artworks'

    artwork_id = db.Column(db.Integer, primary_key=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String, nullable=False)
    thumbnail_url = db.Column(db.String, nullable=True)
    year = db.Column(db.Integer, nullable=True)
    medium = db.Column(db.String(100), nullable=True) # Adjust String length and nullable as needed
    rarity = db.Column(db.String(20), nullable=True)  # e.g., 'Common', 'Rare', 'Epic'
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # --- Relationships ---
    # Relationship back to the User (Artist) who created this artwork
    artist = db.relationship('User', back_populates='created_artworks')

    # Relationship to collections (one artwork can be in many collections)
    collections = db.relationship('Collection', back_populates='artwork', lazy='dynamic', cascade='all, delete-orphan')

    serialize_rules = (
        # Rule to include only specific fields from the related 'artist' (User) object
        'artist.user_id',    # Include artist's user_id
        'artist.username', # Include artist's username
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
        # Potentially add a unique constraint on (title, artist_id, edition_number)
        # if that combination should be unique, depends on requirements.
        # db.UniqueConstraint('title', 'artist_id', 'edition_number', name='uq_artwork_edition'),
    )