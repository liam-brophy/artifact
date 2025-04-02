from datetime import datetime
from sqlalchemy_serializer import SerializerMixin

# Import db instance
from server.app import db

class UserFollow(db.Model, SerializerMixin):
    __tablename__ = 'user_follows'
    # Define composite primary key below in __table_args__

    patron_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True, nullable=False)
    artist_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True, nullable=False)
    created_at = db.Column(db.TIMESTAMP, nullable=False, default=datetime.utcnow)

    # --- Relationships ---
    # Relationship back to the User who is the follower (Patron)
    # Use custom backref names if 'follower'/'followed' are ambiguous or conflict
    follower = db.relationship('User', foreign_keys=[patron_id], back_populates='following')
    # Relationship back to the User who is being followed (Artist)
    followed_artist = db.relationship('User', foreign_keys=[artist_id], back_populates='followers')


    serialize_rules = (
    'follower.(user_id, username)',      # Basic info of the follower (patron)
    'followed_artist.(user_id, username)', # Basic info of the followed (artist)
    )

    def __repr__(self):
        return f'<UserFollow Patron {self.patron_id} follows Artist {self.artist_id}>'


    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Indexes for faster lookups
        db.Index('idx_userfollows_patron_id', 'patron_id'),
        db.Index('idx_userfollows_artist_id', 'artist_id'),
        # Ensure a user cannot follow themselves (DB constraint if possible, or enforce in application logic)
        # db.CheckConstraint('patron_id != artist_id', name='chk_no_self_follow'), # Syntax varies by DB
    )