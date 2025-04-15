import pytest
from server.models.trade import Trade
from server.models.collection import Collection
from server.models.user import User
from server.models.artwork import Artwork
from server.models.user_follow import UserFollow
from server.app import db
import random

class TestTradeHelpers:
    """Helper methods for testing trade functionality"""
    
    @staticmethod
    def setup_mutual_follows(user1_id, user2_id):
        """Ensure users are following each other"""
        # Check if user1 follows user2
        follow1 = UserFollow.query.filter_by(
            follower_id=user1_id,
            followed_id=user2_id
        ).first()
        
        # If not, create the follow relationship
        if not follow1:
            follow1 = UserFollow(
                follower_id=user1_id,
                followed_id=user2_id
            )
            db.session.add(follow1)
        
        # Check if user2 follows user1
        follow2 = UserFollow.query.filter_by(
            follower_id=user2_id,
            followed_id=user1_id
        ).first()
        
        # If not, create the follow relationship
        if not follow2:
            follow2 = UserFollow(
                follower_id=user2_id,
                followed_id=user1_id
            )
            db.session.add(follow2)
        
        db.session.commit()
        return True
    
    @staticmethod
    def create_test_trade(initiator_id, recipient_id):
        """
        Create a test trade between two users
        Returns (trade, initiator_artwork, recipient_artwork)
        """
        # Ensure they follow each other
        TestTradeHelpers.setup_mutual_follows(initiator_id, recipient_id)
        
        # Find artwork owned by initiator
        initiator_collection = Collection.query.filter_by(patron_id=initiator_id).all()
        if not initiator_collection:
            raise ValueError("Initiator doesn't own any artwork")
            
        # Find artwork owned by recipient
        recipient_collection = Collection.query.filter_by(patron_id=recipient_id).all()
        if not recipient_collection:
            raise ValueError("Recipient doesn't own any artwork")
        
        # Select a random artwork from each collection
        initiator_artwork = random.choice(initiator_collection)
        recipient_artwork = random.choice(recipient_collection)
        
        # Create the trade
        trade = Trade(
            initiator_id=initiator_id,
            recipient_id=recipient_id,
            offered_artwork_id=initiator_artwork.artwork_id,
            requested_artwork_id=recipient_artwork.artwork_id,
            message="Test trade offer",
            status='pending'
        )
        
        db.session.add(trade)
        db.session.commit()
        
        return trade, initiator_artwork, recipient_artwork
    
    @staticmethod
    def validate_trade_completion(trade_id):
        """
        Validate that a trade was completed correctly
        Returns (success, message) tuple
        """
        # Get the trade
        trade = Trade.query.get(trade_id)
        if not trade:
            return False, "Trade not found"
            
        if trade.status != 'accepted':
            return False, f"Trade has incorrect status: {trade.status}"
        
        # Check that ownership was transferred correctly
        initiator_has_requested = Collection.query.filter_by(
            patron_id=trade.initiator_id,
            artwork_id=trade.requested_artwork_id
        ).first()
        
        recipient_has_offered = Collection.query.filter_by(
            patron_id=trade.recipient_id,
            artwork_id=trade.offered_artwork_id
        ).first()
        
        if not initiator_has_requested:
            return False, "Initiator didn't receive the requested artwork"
            
        if not recipient_has_offered:
            return False, "Recipient didn't receive the offered artwork"
            
        # Check that conflicts were handled
        conflicting_trades = Trade.query.filter(
            Trade.status == 'pending',
            Trade.trade_id != trade.trade_id,
            ((Trade.offered_artwork_id == trade.offered_artwork_id) | 
             (Trade.offered_artwork_id == trade.requested_artwork_id) |
             (Trade.requested_artwork_id == trade.offered_artwork_id) |
             (Trade.requested_artwork_id == trade.requested_artwork_id))
        ).all()
        
        if conflicting_trades:
            return False, f"There are still {len(conflicting_trades)} conflicting pending trades"
            
        return True, "Trade was completed successfully"