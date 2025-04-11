from datetime import datetime, timedelta
from sqlalchemy import func

from server.app import db
from server.models.user import User
from server.models.user_pack import UserPack
from server.models.pack_type import PackType


def ensure_daily_pack_type_exists():
    """
    Ensures that a "Daily Pack" type exists in the database.
    Returns the pack_type object.
    """
    # Try to find an existing Daily Pack type
    daily_pack = PackType.query.filter_by(name="Daily Pack").first()
    
    # If it doesn't exist, create it
    if daily_pack is None:
        print("Creating Daily Pack type...")
        daily_pack = PackType(
            name="Daily Pack",
            description="A free pack given daily to active users",
            recipe={
                "common": 3,    # 3 common artworks
                "uncommon": 1,  # 1 uncommon artwork
                "rare": 0.2     # 20% chance of a rare artwork
            }
        )
        db.session.add(daily_pack)
        db.session.commit()
        print(f"Daily Pack type created with ID: {daily_pack.pack_type_id}")
    
    return daily_pack


def generate_daily_packs():
    """
    Function to generate daily packs for all active users.
    This would be called by your scheduler once per day.
    """
    # Ensure we have a Daily Pack type
    daily_pack_type = ensure_daily_pack_type_exists()
    
    # Get all users (you might want to filter for active users)
    users = User.query.all()
    
    # Track results for logging
    success_count = 0
    error_count = 0
    already_received_count = 0
    
    # Today's date for comparison
    today = datetime.utcnow().date()
    
    # Process each user
    for user in users:
        try:
            # Check if user already received a pack today
            latest_pack = UserPack.query.filter(
                UserPack.user_id == user.user_id,
                UserPack.pack_type_id == daily_pack_type.pack_type_id
            ).order_by(UserPack.acquired_at.desc()).first()
            
            # If they have a latest pack, check if it's from today
            if latest_pack and latest_pack.acquired_at.date() == today:
                already_received_count += 1
                continue
            
            # Create a new pack for this user
            new_pack = UserPack(
                user_id=user.user_id,
                pack_type_id=daily_pack_type.pack_type_id,
                # acquired_at defaults to current timestamp
            )
            db.session.add(new_pack)
            success_count += 1
            
        except Exception as e:
            error_count += 1
            print(f"Error generating daily pack for user {user.user_id}: {str(e)}")
    
    # Commit all changes
    try:
        db.session.commit()
        print(f"Daily pack generation complete: {success_count} new packs, "
              f"{already_received_count} already received, {error_count} errors")
        return success_count
    except Exception as e:
        db.session.rollback()
        print(f"Transaction failed during daily pack generation: {str(e)}")
        return 0


def get_next_daily_pack_time(user_id):
    """
    Calculate when the user will receive their next daily pack.
    
    Returns:
        - None if user doesn't have any packs yet
        - A datetime object for when the next pack will be available
        - If a pack is already available today but not claimed, returns None
    """
    # Get the daily pack type
    daily_pack_type = PackType.query.filter_by(name="Daily Pack").first()
    if not daily_pack_type:
        return None  # Daily pack type doesn't exist yet
    
    # Find user's most recent pack of this type
    latest_pack = UserPack.query.filter(
        UserPack.user_id == user_id,
        UserPack.pack_type_id == daily_pack_type.pack_type_id
    ).order_by(UserPack.acquired_at.desc()).first()
    
    if not latest_pack:
        return None  # User has never received this pack type
    
    # Calculate when the next pack would be available
    # (Midnight UTC following the day they received their last pack)
    last_pack_day = latest_pack.acquired_at.date()
    next_pack_day = last_pack_day + timedelta(days=1)
    next_pack_time = datetime.combine(next_pack_day, datetime.min.time())
    
    # If the next pack time is in the past, the pack is already available
    if next_pack_time <= datetime.utcnow():
        return None  # Pack is already available
    
    return next_pack_time