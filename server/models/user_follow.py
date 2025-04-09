from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy import ForeignKey, Integer, Column, TIMESTAMP, Index # Added Column
# Import db instance
from server.app import db

class UserFollow(db.Model, SerializerMixin):
    __tablename__ = 'user_follows'

    # Foreign Keys forming the composite primary key
    # --- ADDED ondelete='CASCADE' to both ForeignKeys ---
    patron_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True, nullable=False)
    artist_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)

    # --- Relationships ---
    # Relationship back to the User who is the follower (Patron)
    follower = db.relationship('User', foreign_keys=[patron_id], back_populates='following')
    # Relationship back to the User who is being followed (Artist)
    followed_artist = db.relationship('User', foreign_keys=[artist_id], back_populates='followers')

    # --- Serialization ---
    serialize_rules = (
        # Basic info of the follower (patron)
        'follower.user_id',
        'follower.username',
        # Basic info of the followed (artist)
        'followed_artist.user_id',
        'followed_artist.username',
        # Exclude the direct relationships themselves if user info is included above
        '-follower',
        '-followed_artist',
    )

    def __repr__(self):
        return f'<UserFollow Patron {self.patron_id} follows Artist {self.artist_id}>'

    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Define composite primary key constraint explicitly (good practice)
        db.PrimaryKeyConstraint('patron_id', 'artist_id', name='pk_user_follows'),
        # Indexes for faster lookups
        Index('idx_userfollows_patron_id', 'patron_id'),
        Index('idx_userfollows_artist_id', 'artist_id'),
        # Optional: DB Check constraint to prevent self-follow (syntax varies)
        # db.CheckConstraint('patron_id != artist_id', name='chk_no_self_follow'),
    )