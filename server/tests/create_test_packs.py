#!/usr/bin/env python3

"""
Script to create test packs for a specific user.
This will create a Premium Pack type if it doesn't exist
and assign multiple packs to the specified user.

Usage:
    python -m server.tests.create_test_packs
"""

import os
import sys
import argparse
from datetime import datetime

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import app context and models
from server.app import create_app, db
from server.models.user import User
from server.models.pack_type import PackType
from server.models.user_pack import UserPack


def ensure_premium_pack_type_exists():
    """
    Ensures that a "Premium Pack" type exists in the database.
    Returns the pack_type object.
    """
    # Try to find an existing Premium Pack type
    premium_pack = PackType.query.filter_by(name="Premium Pack").first()
    
    # If it doesn't exist, create it
    if premium_pack is None:
        print("Creating Premium Pack type...")
        premium_pack = PackType(
            name="Premium Pack",
            description="A premium pack with better rewards",
            recipe={
                "common": 1,     # 1 common artwork
                "uncommon": 2,   # 2 uncommon artworks
                "rare": 1,       # 1 rare artwork
                "legendary": 0.5  # 50% chance of a legendary artwork
            }
        )
        db.session.add(premium_pack)
        db.session.commit()
        print(f"Premium Pack type created with ID: {premium_pack.pack_type_id}")
    
    return premium_pack


def create_packs_for_user(user_id, pack_count=3):
    """
    Creates a specified number of premium packs for a user.
    
    Args:
        user_id (int): The ID of the user to create packs for
        pack_count (int): Number of packs to create
    
    Returns:
        int: Number of packs created
    """
    # Ensure user exists
    user = User.query.get(user_id)
    if not user:
        print(f"User with ID {user_id} not found.")
        return 0
    
    # Get premium pack type
    premium_pack = ensure_premium_pack_type_exists()
    
    # Create packs
    created_count = 0
    for i in range(pack_count):
        new_pack = UserPack(
            user_id=user_id,
            pack_type_id=premium_pack.pack_type_id,
            # acquired_at defaults to current timestamp
        )
        db.session.add(new_pack)
        created_count += 1
    
    # Commit all changes
    try:
        db.session.commit()
        print(f"Successfully created {created_count} premium packs for user {user.username}.")
        return created_count
    except Exception as e:
        db.session.rollback()
        print(f"Error creating packs: {str(e)}")
        return 0


def main(args):
    """Main function to create test packs"""
    app = create_app()
    
    with app.app_context():
        user_id = args.user_id
        pack_count = args.count
        
        # If no user ID provided, use default
        if not user_id:
            user_id = 23  # liam3's ID
            print(f"No user ID provided, using default user ID: {user_id}")
        
        create_packs_for_user(user_id, pack_count)
        
        # Show the user's packs after creation
        user_packs = UserPack.query.filter_by(user_id=user_id).all()
        
        print(f"\nUser now has {len(user_packs)} packs:")
        for pack in user_packs:
            status = "Opened" if pack.opened_at else "Unopened"
            print(f" - {pack.pack_type.name} (Status: {status})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create test packs for a user")
    parser.add_argument('--user-id', type=int, help='ID of the user to create packs for (default: 23 for liam3)')
    parser.add_argument('--count', type=int, default=3, help='Number of packs to create (default: 3)')
    
    args = parser.parse_args()
    main(args)