#!/usr/bin/env python3

"""
Manual test script for the daily pack generation feature.
This script provides a CLI interface to test pack functionality.

Usage:
    python -m server.tests.manual_test_daily_packs
"""

import os
import sys
from datetime import datetime
import argparse

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import app context and models
from server.app import create_app, db
from server.models.user import User
from server.models.pack_type import PackType
from server.models.user_pack import UserPack
from server.services.scheduler_service import (
    ensure_daily_pack_type_exists,
    generate_daily_packs,
    get_next_daily_pack_time
)


def display_user_packs(user_id=None):
    """Display information about user packs"""
    query = UserPack.query
    if user_id:
        query = query.filter(UserPack.user_id == user_id)
    
    user_packs = query.all()
    
    print(f"\n{'=' * 50}")
    print(f"{'USER PACKS':^50}")
    print(f"{'=' * 50}")
    
    if not user_packs:
        print("No packs found.")
        return
    
    for pack in user_packs:
        status = "Opened" if pack.opened_at else "Unopened"
        acquired = pack.acquired_at.strftime("%Y-%m-%d %H:%M:%S") if pack.acquired_at else "N/A"
        opened = pack.opened_at.strftime("%Y-%m-%d %H:%M:%S") if pack.opened_at else "N/A"
        
        print(f"Pack ID: {pack.user_pack_id}")
        print(f"User ID: {pack.user_id}")
        print(f"Pack Type: {pack.pack_type.name}")
        print(f"Status: {status}")
        print(f"Acquired: {acquired}")
        print(f"Opened: {opened}")
        print('-' * 50)


def list_users():
    """List all users in the system for reference"""
    users = User.query.all()
    print(f"\n{'=' * 50}")
    print(f"{'USERS':^50}")
    print(f"{'=' * 50}")
    
    for user in users:
        print(f"ID: {user.user_id} | Username: {user.username} | Role: {user.role}")
    
    print('-' * 50)


def display_pack_types():
    """Display all pack types in the system"""
    pack_types = PackType.query.all()
    print(f"\n{'=' * 50}")
    print(f"{'PACK TYPES':^50}")
    print(f"{'=' * 50}")
    
    if not pack_types:
        print("No pack types found.")
        return
    
    for pack_type in pack_types:
        print(f"ID: {pack_type.pack_type_id}")
        print(f"Name: {pack_type.name}")
        print(f"Description: {pack_type.description}")
        print(f"Recipe: {pack_type.recipe}")
        print('-' * 50)


def main(args):
    """Main test function with command-line options"""
    app = create_app()
    with app.app_context():
        print("\n🎮 Daily Pack Testing Utility 🎮")
        
        if args.list_users:
            list_users()
            return
            
        if args.list_pack_types:
            display_pack_types()
            return
            
        if args.view_user_packs:
            if args.user_id:
                print(f"Viewing packs for user ID: {args.user_id}")
                display_user_packs(args.user_id)
            else:
                print("Viewing all user packs")
                display_user_packs()
            return
            
        # Default action: run the pack generation test
        print("Starting daily pack test...")
        
        # 1. Check for Daily Pack type or create it
        daily_pack = ensure_daily_pack_type_exists()
        print(f"\nDaily Pack Type:")
        print(f"  ID: {daily_pack.pack_type_id}")
        print(f"  Name: {daily_pack.name}")
        print(f"  Description: {daily_pack.description}")
        print(f"  Recipe: {daily_pack.recipe}")
        
        # 2. Get count of users and current packs
        user_count = User.query.count()
        pack_count_before = UserPack.query.filter(
            UserPack.pack_type_id == daily_pack.pack_type_id
        ).count()
        
        print(f"\nUsers in system: {user_count}")
        print(f"Daily packs before generation: {pack_count_before}")
        
        # 3. Generate daily packs
        print("\nGenerating daily packs...")
        new_pack_count = generate_daily_packs()
        
        # 4. Count packs after generation
        pack_count_after = UserPack.query.filter(
            UserPack.pack_type_id == daily_pack.pack_type_id
        ).count()
        
        print(f"Generation result: {new_pack_count} new packs created")
        print(f"Daily packs after generation: {pack_count_after}")
        
        # 5. Display pack information for a sample user
        if args.user_id:
            user = User.query.filter_by(user_id=args.user_id).first()
        else:
            user = User.query.first()
            
        if user:
            print(f"\nSample user: {user.username} (ID: {user.user_id})")
            display_user_packs(user.user_id)
            
            # 6. Check next daily pack time
            next_time = get_next_daily_pack_time(user.user_id)
            if next_time:
                print(f"Next daily pack available at: {next_time}")
                print(f"Time until next pack: {next_time - datetime.utcnow()}")
            else:
                print("Next daily pack: Available now (or no packs received yet)")
        
        print("\nTest completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test daily pack generation functionality")
    parser.add_argument('--list-users', action='store_true', help='List all users in the system')
    parser.add_argument('--list-pack-types', action='store_true', help='List all pack types in the system')
    parser.add_argument('--view-user-packs', action='store_true', help='View user packs')
    parser.add_argument('--user-id', type=int, help='Specify a user ID for operations')
    
    args = parser.parse_args()
    main(args)