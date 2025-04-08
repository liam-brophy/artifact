from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from server.app import db

class PackType(db.Model, SerializerMixin):
    __tablename__ = 'pack_types'

    pack_type_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    # How many artworks does this type of pack contain?
    recipe = db.Column(JSONB, nullable=False)
    # Optional: Add cost, specific selection rules (e.g., JSON for rarity distribution)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())

    # --- Relationships ---
    # One PackType can correspond to many instances owned by users (UserPack)
    user_packs = db.relationship('UserPack', back_populates='pack_type', lazy='dynamic')

    # --- Serialization ---
    serialize_rules = ('-user_packs',) # Usually don't need to serialize the instances from the type


    @property
    def total_artworks_in_recipe(self):
        if isinstance(self.recipe, dict):
            return sum(self.recipe.values())
        return 0 # Or handle error/default

    
    def __repr__(self):
        return f'<PackType {self.pack_type_id}: {self.name}>'

    # --- Table Args ---
    __table_args__ = (
        db.Index('idx_pack_types_name', 'name'),
    )