import pytest
from server.app import create_app, db
from server.models.user import User
from server.models.artwork import Artwork
from server.models.collection import Collection
from server.models.trade import Trade
from .test_trades import TestTradeHelpers

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_trade_execution(app, client):
    """Test that trades are executed correctly"""
    with app.app_context():
        # Create two test users
        user1 = User(username='trader1', email='trader1@example.com')
        user1.set_password('password123')
        user2 = User(username='trader2', email='trader2@example.com')
        user2.set_password('password123')
        
        db.session.add_all([user1, user2])
        db.session.commit()
        
        # Create some artwork
        artwork1 = Artwork(
            title='Test Artwork 1',
            image_url='http://example.com/artwork1.jpg',
            rarity='common',
            user_id=user1.user_id,
            artist_name='Artist 1'
        )
        
        artwork2 = Artwork(
            title='Test Artwork 2',
            image_url='http://example.com/artwork2.jpg',
            rarity='rare',
            user_id=user2.user_id,
            artist_name='Artist 2'
        )
        
        db.session.add_all([artwork1, artwork2])
        db.session.commit()
        
        # Assign artworks to users' collections
        collection1 = Collection(
            patron_id=user1.user_id,
            artwork_id=artwork1.artwork_id
        )
        
        collection2 = Collection(
            patron_id=user2.user_id,
            artwork_id=artwork2.artwork_id
        )
        
        db.session.add_all([collection1, collection2])
        db.session.commit()
        
        # Setup mutual follows
        TestTradeHelpers.setup_mutual_follows(user1.user_id, user2.user_id)
        
        # Create a trade
        trade = Trade(
            initiator_id=user1.user_id,
            recipient_id=user2.user_id,
            offered_artwork_id=artwork1.artwork_id,
            requested_artwork_id=artwork2.artwork_id,
            message="Test trade",
            status='pending'
        )
        
        db.session.add(trade)
        db.session.commit()
        
        # Execute the trade
        success, message = Trade.execute_trade(trade.trade_id)
        
        # Validate the trade was completed successfully
        assert success, f"Trade execution failed: {message}"
        
        # Validate the trade completion
        success, validation_message = TestTradeHelpers.validate_trade_completion(trade.trade_id)
        assert success, validation_message
        
        # Check user1 now owns artwork2
        user1_owns_artwork2 = Collection.query.filter_by(
            patron_id=user1.user_id,
            artwork_id=artwork2.artwork_id
        ).first()
        assert user1_owns_artwork2 is not None, "User1 should now own artwork2"
        
        # Check user2 now owns artwork1
        user2_owns_artwork1 = Collection.query.filter_by(
            patron_id=user2.user_id,
            artwork_id=artwork1.artwork_id
        ).first()
        assert user2_owns_artwork1 is not None, "User2 should now own artwork1"
        
        # Check original ownership records are gone
        user1_still_owns_artwork1 = Collection.query.filter_by(
            patron_id=user1.user_id,
            artwork_id=artwork1.artwork_id
        ).first()
        assert user1_still_owns_artwork1 is None, "User1 should no longer own artwork1"
        
        user2_still_owns_artwork2 = Collection.query.filter_by(
            patron_id=user2.user_id,
            artwork_id=artwork2.artwork_id
        ).first()
        assert user2_still_owns_artwork2 is None, "User2 should no longer own artwork2"

def test_concurrent_trade_handling(app, client):
    """Test that concurrent trades for the same artworks are handled correctly"""
    with app.app_context():
        # Create three test users
        user1 = User(username='trader1', email='trader1@example.com')
        user1.set_password('password123')
        user2 = User(username='trader2', email='trader2@example.com')
        user2.set_password('password123')
        user3 = User(username='trader3', email='trader3@example.com')
        user3.set_password('password123')
        
        db.session.add_all([user1, user2, user3])
        db.session.commit()
        
        # Create some artwork
        artwork1 = Artwork(
            title='Test Artwork 1',
            image_url='http://example.com/artwork1.jpg',
            rarity='common',
            user_id=user1.user_id,
            artist_name='Artist 1'
        )
        
        artwork2 = Artwork(
            title='Test Artwork 2',
            image_url='http://example.com/artwork2.jpg',
            rarity='rare',
            user_id=user2.user_id,
            artist_name='Artist 2'
        )
        
        artwork3 = Artwork(
            title='Test Artwork 3',
            image_url='http://example.com/artwork3.jpg',
            rarity='epic',
            user_id=user3.user_id,
            artist_name='Artist 3'
        )
        
        db.session.add_all([artwork1, artwork2, artwork3])
        db.session.commit()
        
        # Assign artworks to users' collections
        collection1 = Collection(
            patron_id=user1.user_id,
            artwork_id=artwork1.artwork_id
        )
        
        collection2 = Collection(
            patron_id=user2.user_id,
            artwork_id=artwork2.artwork_id
        )
        
        collection3 = Collection(
            patron_id=user3.user_id,
            artwork_id=artwork3.artwork_id
        )
        
        db.session.add_all([collection1, collection2, collection3])
        db.session.commit()
        
        # Setup mutual follows
        TestTradeHelpers.setup_mutual_follows(user1.user_id, user2.user_id)
        TestTradeHelpers.setup_mutual_follows(user1.user_id, user3.user_id)
        TestTradeHelpers.setup_mutual_follows(user2.user_id, user3.user_id)
        
        # Create trade 1: user1 offers artwork1 for user2's artwork2
        trade1 = Trade(
            initiator_id=user1.user_id,
            recipient_id=user2.user_id,
            offered_artwork_id=artwork1.artwork_id,
            requested_artwork_id=artwork2.artwork_id,
            message="Trade from user1 to user2",
            status='pending'
        )
        
        # Create trade 2: user3 also offers artwork3 for user2's artwork2
        trade2 = Trade(
            initiator_id=user3.user_id,
            recipient_id=user2.user_id,
            offered_artwork_id=artwork3.artwork_id,
            requested_artwork_id=artwork2.artwork_id,
            message="Trade from user3 to user2",
            status='pending'
        )
        
        db.session.add_all([trade1, trade2])
        db.session.commit()
        
        # Accept trade 1
        success, message = Trade.execute_trade(trade1.trade_id)
        assert success, f"Trade 1 execution failed: {message}"
        
        # Validate trade 1 completion
        success, validation_message = TestTradeHelpers.validate_trade_completion(trade1.trade_id)
        assert success, validation_message
        
        # Check that trade 2 is automatically canceled (or rejected)
        trade2 = Trade.query.get(trade2.trade_id)
        assert trade2.status == 'canceled', f"Trade 2 should be canceled, but is {trade2.status}"