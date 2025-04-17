from datetime import datetime
from flask import current_app
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.sql import func
from sqlalchemy import ForeignKey, Integer, String, Text, DateTime, Column, Index, CheckConstraint, and_, or_, Enum
from sqlalchemy.dialects.postgresql import ENUM

# Import db from extensions instead of from app to avoid circular imports
from server.extensions import db

# Define the enum values based on your database schema - updated to use uppercase values
TradeStatusEnum = ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED', name='tradestatus', create_type=False)

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
    
    # Trade status as an enum that already exists in the database
    # Updated to use uppercase values to match database
    status = Column(TradeStatusEnum, nullable=False, default='PENDING')
    
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
    
    @classmethod
    def execute_trade(cls, trade_id):
        """
        Execute a trade with proper transaction isolation
        Returns (success, message) tuple
        """
        from server.models.collection import Collection
        
        # Get the trade by ID and lock it for update
        trade = cls.query.with_for_update().get(trade_id)
        
        if not trade:
            return False, "Trade not found"
        
        if trade.status != 'PENDING':
            return False, f"Cannot accept a trade with status: {trade.status}"
        
        # Verify the artworks are still owned by the respective users
        initiator_ownership = Collection.query.with_for_update().filter_by(
            patron_id=trade.initiator_id,
            artwork_id=trade.offered_artwork_id
        ).first()
        
        recipient_ownership = Collection.query.with_for_update().filter_by(
            patron_id=trade.recipient_id,
            artwork_id=trade.requested_artwork_id
        ).first()
        
        if not initiator_ownership or not recipient_ownership:
            trade.status = 'REJECTED'  # Automatically reject if conditions changed
            db.session.commit()
            return False, "Trade cannot be completed because one or both artworks are no longer available"
        
        try:
            # 1. Update trade status to ACCEPTED
            trade.status = 'ACCEPTED'
            
            # 2. Exchange artwork ownership
            # Update ownership records
            initiator_ownership.patron_id = trade.recipient_id
            recipient_ownership.patron_id = trade.initiator_id
            
            # 3. Check for and cancel conflicting trades
            # Find other pending trades involving either of these artworks
            conflicting_trades = cls.query.filter(
                and_(
                    cls.status == 'PENDING',
                    cls.trade_id != trade.trade_id,
                    or_(
                        cls.offered_artwork_id.in_([trade.offered_artwork_id, trade.requested_artwork_id]),
                        cls.requested_artwork_id.in_([trade.offered_artwork_id, trade.requested_artwork_id])
                    )
                )
            ).all()
            
            # Cancel all conflicting trades
            for conflict in conflicting_trades:
                conflict.status = 'CANCELED'
            
            db.session.commit()
            return True, "Trade successfully completed"
        except Exception as e:
            db.session.rollback()
            # Log the specific error for debugging on the server
            current_app.logger.error(f"Error executing trade {trade_id}: {str(e)}", exc_info=True) 
            # Return False and a user-friendly error message
            return False, f"Error completing trade: {str(e)}"
    
    # --- Database Constraints/Indexes ---
    __table_args__ = (
        # Index for faster lookup of trades by user
        Index('idx_trades_initiator_id', 'initiator_id'),
        Index('idx_trades_recipient_id', 'recipient_id'),
        # Index for sorting/filtering by status and date
        Index('idx_trades_status', 'status'),
        Index('idx_trades_created_at', 'created_at'),
    )