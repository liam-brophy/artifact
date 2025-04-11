"""
Tests for the daily pack generation functionality.

This module includes tests for:
- Daily pack type creation
- Daily pack generation for users
- Next pack availability calculation
"""

import pytest
from datetime import datetime, timedelta

from server.models.user_pack import UserPack
from server.services.scheduler_service import (
    ensure_daily_pack_type_exists, 
    generate_daily_packs,
    get_next_daily_pack_time
)


def test_ensure_daily_pack_type_exists(db_session):
    """Test that the daily pack type can be created if it doesn't exist."""
    # First call should create the pack type
    daily_pack = ensure_daily_pack_type_exists()
    assert daily_pack is not None
    assert daily_pack.name == "Daily Pack"
    assert "common" in daily_pack.recipe
    assert "uncommon" in daily_pack.recipe
    assert "rare" in daily_pack.recipe
    
    # Second call should return the existing pack type without creating a new one
    pack_type_id = daily_pack.pack_type_id
    second_call = ensure_daily_pack_type_exists()
    assert second_call.pack_type_id == pack_type_id


def test_generate_daily_packs(db_session, sample_users, daily_pack_type):
    """Test daily pack generation for users."""
    # Count initial packs
    initial_pack_count = UserPack.query.filter_by(
        pack_type_id=daily_pack_type.pack_type_id
    ).count()
    assert initial_pack_count == 0
    
    # Generate packs for all users
    success_count = generate_daily_packs()
    
    # We should have created one pack per user
    assert success_count == len(sample_users)
    
    # Verify packs were created in the database
    new_pack_count = UserPack.query.filter_by(
        pack_type_id=daily_pack_type.pack_type_id
    ).count()
    assert new_pack_count == len(sample_users)
    
    # Running again on the same day should not create new packs
    second_run_count = generate_daily_packs()
    assert second_run_count == 0
    
    # Pack count should remain the same
    unchanged_count = UserPack.query.filter_by(
        pack_type_id=daily_pack_type.pack_type_id
    ).count()
    assert unchanged_count == len(sample_users)


def test_next_daily_pack_time(db_session, sample_users, daily_pack_type):
    """Test calculation of next daily pack availability time."""
    user = sample_users[0]
    
    # Before receiving any packs, next time should be None
    initial_next_time = get_next_daily_pack_time(user.user_id)
    assert initial_next_time is None
    
    # Generate packs
    generate_daily_packs()
    
    # After receiving a pack, next time should be set to tomorrow
    next_time = get_next_daily_pack_time(user.user_id)
    assert next_time is not None
    
    # Next time should be midnight UTC tomorrow
    today = datetime.utcnow().date()
    expected_next = datetime.combine(today + timedelta(days=1), datetime.min.time())
    
    # Allow a small difference due to test execution time
    time_difference = abs((next_time - expected_next).total_seconds())
    assert time_difference < 5  # Within 5 seconds of expected time


def test_next_daily_pack_with_backdated_pack(db_session, sample_users, daily_pack_type):
    """Test next pack time calculation with a backdated pack."""
    user = sample_users[0]
    
    # Create a pack from yesterday
    yesterday = datetime.utcnow() - timedelta(days=1)
    backdated_pack = UserPack(
        user_id=user.user_id,
        pack_type_id=daily_pack_type.pack_type_id,
        acquired_at=yesterday
    )
    db_session.add(backdated_pack)
    db_session.commit()
    
    # Next pack time should be None (available now since it's past midnight after yesterday)
    next_time = get_next_daily_pack_time(user.user_id)
    assert next_time is None  # None means pack is already available


def test_manual_daily_pack_generation(app, client, sample_users, daily_pack_type):
    """Test the admin endpoint for manually generating daily packs."""
    # TODO: Implement test for the admin API endpoint
    # This would require setting up authentication and testing the API endpoint
    pass