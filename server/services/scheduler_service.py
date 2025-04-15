from datetime import datetime, timedelta
from sqlalchemy import func
import logging
import traceback

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
        logging.info("Creating Daily Pack type...")
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
        logging.info(f"Daily Pack type created with ID: {daily_pack.pack_type_id}")
    
    return daily_pack


def generate_daily_packs():
    """
    Function to generate daily packs for all active users.
    This would be called by your scheduler once per day.
    
    Returns:
        int: Number of successfully created packs
    """
    # Log start of pack generation
    logging.info("Starting daily pack generation process")
    
    # Ensure we have a Daily Pack type
    try:
        daily_pack_type = ensure_daily_pack_type_exists()
    except Exception as e:
        logging.error(f"Failed to ensure daily pack type exists: {str(e)}")
        logging.error(traceback.format_exc())
        return 0
    
    # Get all users (you might want to filter for active users)
    try:
        users = User.query.all()
        logging.info(f"Found {len(users)} users to process for daily packs")
    except Exception as e:
        logging.error(f"Failed to query users: {str(e)}")
        logging.error(traceback.format_exc())
        return 0
    
    # Track results for logging
    success_count = 0
    error_count = 0
    already_received_count = 0
    
    # Today's date for comparison
    today = datetime.utcnow().date()
    
    # Process each user in batches to prevent long-running transactions
    batch_size = 100
    for i in range(0, len(users), batch_size):
        batch_users = users[i:i+batch_size]
        batch_success = 0
        
        logging.info(f"Processing batch {i//batch_size + 1} with {len(batch_users)} users")
        
        # Start a new transaction for this batch
        try:
            for user in batch_users:
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
                    batch_success += 1
                    
                except Exception as e:
                    error_count += 1
                    logging.error(f"Error generating daily pack for user {user.user_id}: {str(e)}")
                    # Continue processing other users in the batch
            
            # Commit the batch
            db.session.commit()
            success_count += batch_success
            logging.info(f"Batch {i//batch_size + 1} completed: {batch_success} packs created")
            
        except Exception as e:
            db.session.rollback()
            error_count += len(batch_users) - already_received_count
            logging.error(f"Transaction failed during batch {i//batch_size + 1}: {str(e)}")
            logging.error(traceback.format_exc())
    
    # Log completion
    logging.info(f"Daily pack generation complete: {success_count} new packs, "
          f"{already_received_count} already received, {error_count} errors")
    
    return success_count


def generate_pack_for_user(user_id):
    """
    Generate a daily pack for a specific user, regardless of whether they 
    already received one today.
    
    Args:
        user_id (int): The ID of the user to generate a pack for
        
    Returns:
        UserPack or None: The newly created user pack or None if failed
    """
    logging.info(f"Starting manual pack generation for user {user_id}")
    
    try:
        # Ensure we have a daily pack type
        daily_pack_type = ensure_daily_pack_type_exists()
        
        # Verify the user exists
        user = User.query.get(user_id)
        if not user:
            logging.error(f"User with ID {user_id} not found")
            return None
        
        # Create a new pack for this user
        new_pack = UserPack(
            user_id=user_id,
            pack_type_id=daily_pack_type.pack_type_id
        )
        
        db.session.add(new_pack)
        db.session.commit()
        
        logging.info(f"Successfully created pack for user {user_id}")
        return new_pack
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to generate pack for user {user_id}: {str(e)}")
        logging.error(traceback.format_exc())
        return None


def get_next_daily_pack_time(user_id):
    """
    Calculate when the user will receive their next daily pack.
    
    Returns:
        - None if user doesn't have any packs yet
        - A datetime object for when the next pack will be available
        - If a pack is already available today but not claimed, returns None
    """
    try:
        # Get the daily pack type
        daily_pack_type = PackType.query.filter_by(name="Daily Pack").first()
        if not daily_pack_type:
            logging.info("Daily pack type doesn't exist yet")
            return None  # Daily pack type doesn't exist yet
        
        # Find user's most recent pack of this type
        latest_pack = UserPack.query.filter(
            UserPack.user_id == user_id,
            UserPack.pack_type_id == daily_pack_type.pack_type_id
        ).order_by(UserPack.acquired_at.desc()).first()
        
        if not latest_pack:
            logging.info(f"User {user_id} has never received a daily pack")
            return None  # User has never received this pack type
        
        # Calculate when the next pack would be available
        # (Midnight UTC following the day they received their last pack)
        last_pack_day = latest_pack.acquired_at.date()
        next_pack_day = last_pack_day + timedelta(days=1)
        next_pack_time = datetime.combine(next_pack_day, datetime.min.time())
        
        # If the next pack time is in the past, the pack is already available
        if next_pack_time <= datetime.utcnow():
            logging.info(f"User {user_id} is eligible for a new daily pack")
            return None  # Pack is already available
        
        logging.info(f"User {user_id} will get next daily pack at {next_pack_time}")
        return next_pack_time
        
    except Exception as e:
        logging.error(f"Error calculating next pack time for user {user_id}: {str(e)}")
        logging.error(traceback.format_exc())
        return None


def check_missing_daily_packs():
    """
    Check for users who haven't received a daily pack in the last 24 hours
    and generate packs for them. This function helps ensure users don't miss out
    on their daily packs due to scheduler failures.
    
    Returns:
        int: Number of recovered packs that were generated
    """
    logging.info("Checking for users who may have missed their daily packs")
    
    try:
        # Ensure we have a Daily Pack type
        daily_pack_type = ensure_daily_pack_type_exists()
        
        # Get all users
        users = User.query.all()
        
        # Get current time for comparison
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        
        # Track recovered packs
        recovered_count = 0
        
        for user in users:
            try:
                # Find user's most recent pack
                latest_pack = UserPack.query.filter(
                    UserPack.user_id == user.user_id,
                    UserPack.pack_type_id == daily_pack_type.pack_type_id
                ).order_by(UserPack.acquired_at.desc()).first()
                
                # If user has no packs or their last pack was more than 24 hours ago
                if not latest_pack or latest_pack.acquired_at < yesterday:
                    # Create a new pack for this user
                    new_pack = UserPack(
                        user_id=user.user_id,
                        pack_type_id=daily_pack_type.pack_type_id
                    )
                    db.session.add(new_pack)
                    recovered_count += 1
                    logging.info(f"Recovered daily pack for user {user.user_id}")
                
            except Exception as e:
                logging.error(f"Error checking/recovering pack for user {user.user_id}: {str(e)}")
        
        # Commit all changes
        if recovered_count > 0:
            db.session.commit()
            logging.info(f"Successfully recovered {recovered_count} daily packs")
        else:
            logging.info("No missing daily packs detected")
        
        return recovered_count
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in check_missing_daily_packs: {str(e)}")
        logging.error(traceback.format_exc())
        return 0