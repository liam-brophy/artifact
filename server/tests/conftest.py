"""
Pytest configuration file for the Artifact application tests.
This file contains fixtures and setup functions that can be shared across multiple test files.
"""

import os
import sys
import pytest
from datetime import datetime

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import app context and models
from server.app import create_app, db
from server.models.user import User
from server.models.pack_type import PackType
from server.models.user_pack import UserPack
from server.services.scheduler_service import ensure_daily_pack_type_exists


@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    # Create the Flask application
    app = create_app('testing')
    
    # Establish an application context
    with app.app_context():
        yield app


@pytest.fixture
def client(app):
    """Test client for the Flask application."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Database session for testing."""
    with app.app_context():
        # Set up the database for testing
        db.create_all()
        
        # Provide the session for testing
        yield db.session
        
        # Clean up after test
        db.session.remove()
        db.drop_all()


@pytest.fixture
def sample_users(db_session):
    """Create sample users for testing."""
    users = []
    for i in range(3):
        user = User(
            username=f"test_user_{i}",
            email=f"test{i}@example.com",
            role='patron' if i < 2 else 'artist'
        )
        user.set_password('password123')
        db_session.add(user)
    
    db_session.commit()
    users = User.query.all()
    return users


@pytest.fixture
def daily_pack_type(db_session):
    """Create a daily pack type for testing."""
    with create_app().app_context():
        daily_pack = ensure_daily_pack_type_exists()
        return daily_pack