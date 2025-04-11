from datetime import datetime
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
from sqlalchemy import ForeignKey, Integer, String, Text, DateTime, Column, Index, CheckConstraint

# Import db instance from the main app file
from server.app import db

class Trade(db.Model, SerializerMixin):
    __tablename__ = 'trades'

    trade_id = Column(Integer, primary_key=True)
    
    # User who initiated the trade
    initiator_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    # User who receives the trade offer
    recipient_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    
    # The offered artwork from the initiator
    offered_artwork_id = Column(Integer, ForeignKey('artworks.artwork_id', ondelete='CASCADE'), nullable=False)
    # The requested artwork from the recipient
    requested_artwork_id = Column(Integer, ForeignKey('artworks.artwork_id', ondelete='CASCADE'), nullable=False)
    
    # Message from initiator to recipient
    message = Column(Text, nullable=True)
    
    # Trade status (using string instead of Enum)
    status = Column(String(20), nullable=False, default='pending')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # --- Relationships ---
    # Relationship to the initiator user
    initiator = db.relationship('User', foreign_keys=[initiator_id], backref='initiated_trades')
    # Relationship to the recipient user
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='received_trades')
    
    # Relationship to the offered artwork
    offered_artwork = db.relationship('Artwork', foreign_keys=[offered_artwork_id])
    # Relationship to the requested artwork
    requested_artwork = db.relationship('Artwork', foreign_keys=[requested_artwork_id])
    
    # --- Serialization ---
    serialize_rules = (
        # Include user information
        'initiator.user_id',
        'initiator.username',
        'recipient.user_id',
        'recipient.username',
        
        # Include artwork information (will use Artwork serialization rules)
        'offered_artwork',
        'requested_artwork',
        
        # Exclude back references to avoid circular references
        '-initiator',
        '-recipient',
    )
    
    def __repr__(self):
        return f'<Trade {self.trade_id}: {self.initiator_id} -> {self.recipient_id}, Status: {self.status}>'
    
    # --- Validation Methods ---
    @staticmethod
    def validate_trade(initiator_id, recipient_id, offered_artwork_id, requested_artwork_id):
        # Check that the users are not the same
        if initiator_id == recipient_id:
            return False, "Cannot trade with yourself."
            
        # These validations will be handled in the routes:
        # - Check that the users follow each other (mutual follow)
        # - Check that the initiator owns the offered artwork
        # - Check that the recipient owns the requested artwork
            
        return True, ""
    
    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Constraint to ensure status is one of the allowed values
        CheckConstraint(status.in_(['pending', 'accepted', 'rejected', 'canceled']), name='valid_trade_status'),
        # Index for faster lookup of trades by user
        Index('idx_trades_initiator_id', 'initiator_id'),
        Index('idx_trades_recipient_id', 'recipient_id'),
        # Index for sorting/filtering by status and date
        Index('idx_trades_status', 'status'),
        Index('idx_trades_created_at', 'created_at'),
    )