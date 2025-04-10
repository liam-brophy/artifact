from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
from sqlalchemy import ForeignKey, Integer, String, Text, Numeric, DateTime, Column, Index # Added Column
import re
from sqlalchemy.dialects.postgresql import ENUM # Import ENUM type

# Import db instance from the main app file
from server.app import db

rarity_enum = ENUM('common', 'uncommon', 'rare', 'epic', 'legendary', name='artwork_rarity_enum', create_type=False)

class Artwork(db.Model, SerializerMixin):
    __tablename__ = 'artworks'

    artwork_id = Column(Integer, primary_key=True)
    # --- ADDED ondelete='CASCADE' to artist_id ForeignKey ---
    artist_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    title = Column(String(255), nullable=False)
    artist_name = Column(String(100), nullable=True)  # Add field for artist name 
    description = Column(Text, nullable=True)
    series = Column(String(100), nullable=True)  # Added field for artwork series
    image_url = Column(String(500), nullable=False) # Increased length based on User model example
    thumbnail_url = Column(String(500), nullable=True) # Increased length
    year = Column(Integer, nullable=True)
    medium = Column(String(100), nullable=True)
    rarity = db.Column(rarity_enum, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- Relationships ---
    # Relationship back to the User (Artist) who created this artwork
    artist = db.relationship('User', back_populates='created_artworks')

    # Relationship to collections (one artwork can be in many collections)
    # Cascade delete Collection entries if Artwork is deleted (via ORM or DB)
    collections = db.relationship('Collection', back_populates='artwork', lazy='dynamic', cascade='all, delete-orphan')

    # --- Serialization ---
    serialize_rules = (
        # Rule to include only specific fields from the related 'artist' (User) object
        'artist.user_id',    # Include artist's user_id
        'artist.username', # Include artist's username
        # Exclude the collections relationship by default
        '-collections',
    )

    def __repr__(self):
        return f'<Artwork {self.artwork_id}: {self.title}>'

    # --- Static Validation Methods (keep as they were) ---
    @staticmethod
    def validate_title(title):
        if not (title and 1 <= len(title) <= 255):
            return False, "Title is required and must be between 1 and 255 characters."
        return True, ""

    @staticmethod
    def validate_url(url, field_name="URL"):
        if not url: return False, f"{field_name} is required."
        if len(url) > 500: return False, f"{field_name} exceeds maximum length of 500 characters."
        if not (url.startswith('http://') or url.startswith('https://')): return False, f"{field_name} must be a valid URL (starting with http:// or https://)."
        return True, ""

    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Index on artist_id for faster lookup of artworks by artist
        Index('idx_artworks_artist_id', 'artist_id'),
        # Index for sorting/filtering
        Index('idx_artworks_created_at', 'created_at'),
    )