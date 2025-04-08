from datetime import datetime
from passlib.hash import pbkdf2_sha256 as sha256
from sqlalchemy_serializer import SerializerMixin
import re

# Import db instance from the main app file
# This assumes db = SQLAlchemy() is defined in app.py before models are imported/used.
# This dependency requires careful import ordering or using the app context.
from server.app import db

class User(db.Model, SerializerMixin):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, server_default='patron')
    profile_image_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.TIMESTAMP, nullable=False, default=datetime.utcnow)
    last_login = db.Column(db.TIMESTAMP, nullable=True)

    # --- Relationships ---
    # Define relationships here later when other models (  Collection, UserFollow) exist
    created_artworks = db.relationship(
        'Artwork',
        back_populates='artist',
        lazy=True,
        cascade='all, delete-orphan' # Example: Delete artworks if artist is deleted
    )

    collections = db.relationship(
        'Collection',
        back_populates='patron',
        lazy='dynamic', # Returns a query object, good for pagination/filtering
        cascade='all, delete-orphan',
        foreign_keys='Collection.patron_id'
    )

    # Users (artists) this user (patron) is following
    # This links User (patron) to the UserFollow association object where they are the patron_id
    following = db.relationship(
        'UserFollow',
        foreign_keys='UserFollow.patron_id',
        back_populates='follower',
        lazy='dynamic', # Query object for pagination
        cascade='all, delete-orphan'
    )

    # Users (patrons) who are following this user (artist)
    # This links User (artist) to the UserFollow association object where they are the artist_id
    followers = db.relationship(
        'UserFollow',
        foreign_keys='UserFollow.artist_id',
        back_populates='followed_artist',
        lazy='dynamic', # Query object for pagination
        cascade='all, delete-orphan'
    )

    packs = db.relationship(
        'UserPack', # Use string reference to avoid import loops
        back_populates='owner',
        lazy='dynamic', # Query object
        cascade='all, delete-orphan', # If user deleted, delete their packs
        foreign_keys='UserPack.user_id' # Explicitly specify FK if needed
    )



    serialize_rules = (
            '-password_hash',
            '-created_artworks',
            '-collections',
            '-following',
            '-followers',
            '-packs',
    )

    def __repr__(self):
        return f'<User {self.username}>'

    def set_password(self, password):
        self.password_hash = sha256.hash(password)

    def check_password(self, password):
        if not self.password_hash:
             return False
        return sha256.verify(password, self.password_hash)

    # --- Static Validation Methods ---
    @staticmethod
    def validate_username(username):
        if not (username and 3 <= len(username) <= 255):
            return False, "Username must be between 3 and 255 characters."
        if not re.match(r"^[A-Za-z0-9_-]+$", username):
            return False, "Username must contain only letters, numbers, underscores, and hyphens."
        return True, ""

    @staticmethod
    def validate_email(email):
        if not (email and "@" in email and "." in email.split("@")[-1]):
             return False, "Invalid email format."
        if len(email) > 255:
             return False, "Email exceeds maximum length of 255 characters."
        return True, ""

    @staticmethod
    def validate_password(password):
        if not password or len(password) < 8:
            return False, "Password must be at least 8 characters long."
        # Add complexity rules if needed using regex
        # if not re.search(r"[A-Z]", password): return False, "Needs uppercase."
        # if not re.search(r"[a-z]", password): return False, "Needs lowercase."
        # if not re.search(r"\d", password): return False, "Needs digit."
        return True, ""

    @classmethod # or @staticmethod
    def validate_role(cls, role):
        valid_roles = {'artist', 'patron'}
        if role and role in valid_roles: # Check if role is truthy AND in the set
            return True, role
        else:
            return False, f"Role must be one of {', '.join(valid_roles)}. Received: '{role}'"

    # --- Database Constraints/Indexes ---
    __table_args__ = (
        db.CheckConstraint(role.in_(['artist', 'patron']), name='role_check'),
        db.Index('idx_users_username', 'username'),
        db.Index('idx_users_email', 'email'),
        db.Index('idx_users_role', 'role'),
    )