from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.sql.expression import func # For random()
from sqlalchemy import not_ # For WHERE NOT IN
from datetime import datetime, timedelta

# Import your models and db session
from server.app import db
from server.models.user import User       # Assuming models are in server.models.*
from server.models.artwork import Artwork
from server.models.collection import Collection
from server.models.pack_type import PackType # Still needed for FK constraint
from server.models.user_pack import UserPack
from server.services.scheduler_service import generate_daily_packs, get_next_daily_pack_time

packs_bp = Blueprint('packs', __name__) # Define blueprint

# --- ADD THIS NEW ROUTE ---
@packs_bp.route('/user-packs', methods=['GET'])
@jwt_required()
def get_unopened_user_packs():
    """
    Fetches a list of unopened packs belonging to the current user.
    """
    current_user_id = get_jwt_identity()

    try:
        # Query UserPack, filter by current user and unopened status.
        # Join with PackType to get the name/description.
        # Select only the necessary columns to send back.
        unopened_packs_query = db.session.query(
                UserPack.user_pack_id, # The ID needed to trigger the 'open' action
                PackType.name,
                PackType.description
            ).join(PackType, UserPack.pack_type_id == PackType.pack_type_id)\
            .filter(UserPack.user_id == current_user_id)\
            .filter(UserPack.opened_at.is_(None)) # Check if opened_at IS NULL

        unopened_packs = unopened_packs_query.all()

        # Format the results into a list of dictionaries
        result_list = [
            {
                "user_pack_id": pack.user_pack_id,
                "name": pack.name,
                "description": pack.description
            }
            for pack in unopened_packs
        ]

        return jsonify(result_list), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching user packs for user {current_user_id}: {e}")
        return jsonify({"error": "An internal error occurred while fetching packs."}), 500


# Route for next daily pack availability
@packs_bp.route('/user-packs/next-availability', methods=['GET'])
@jwt_required()
def get_next_pack_availability():
    """
    Fetches information about when the user's next daily pack will be available.
    """
    current_user_id = get_jwt_identity()

    try:
        next_pack_time = get_next_daily_pack_time(current_user_id)
        
        # Check if user has any unopened packs
        unopened_daily_packs_count = UserPack.query.join(PackType, UserPack.pack_type_id == PackType.pack_type_id)\
            .filter(UserPack.user_id == current_user_id)\
            .filter(PackType.name == "Daily Pack")\
            .filter(UserPack.opened_at.is_(None))\
            .count()
        
        return jsonify({
            "next_available_at": next_pack_time.isoformat() if next_pack_time else None,
            "has_unopened_daily_packs": unopened_daily_packs_count > 0
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching next pack availability for user {current_user_id}: {e}")
        return jsonify({"error": "An internal error occurred while checking pack availability."}), 500


# Route for users to claim their daily pack if available
@packs_bp.route('/user-packs/claim-daily', methods=['POST'])
@jwt_required()
def claim_daily_pack():
    """
    Endpoint for users to claim their daily pack if they're eligible.
    """
    current_user_id = get_jwt_identity()
    
    try:
        # Get the daily pack type
        daily_pack_type = PackType.query.filter_by(name="Daily Pack").first()
        if not daily_pack_type:
            return jsonify({"error": "Daily pack type not configured in the system"}), 500
        
        # Check if user already has an unopened daily pack
        existing_unopened = UserPack.query.join(PackType, UserPack.pack_type_id == PackType.pack_type_id)\
            .filter(UserPack.user_id == current_user_id)\
            .filter(PackType.name == "Daily Pack")\
            .filter(UserPack.opened_at.is_(None))\
            .first()
            
        if existing_unopened:
            return jsonify({
                "message": "You already have an unopened daily pack",
                "user_pack_id": existing_unopened.user_pack_id
            }), 200
        
        # Check if the user is eligible for a new daily pack
        next_time = get_next_daily_pack_time(current_user_id)
        if next_time is not None:
            # Format time for display
            formatted_time = next_time.strftime('%Y-%m-%d %H:%M:%S UTC')
            return jsonify({
                "error": f"Your next daily pack will be available at {formatted_time}",
                "next_available_at": next_time.isoformat()
            }), 400
            
        # User is eligible, create a new pack
        try:
            new_pack = UserPack(
                user_id=current_user_id,
                pack_type_id=daily_pack_type.pack_type_id
            )
            db.session.add(new_pack)
            db.session.commit()
            
            return jsonify({
                "message": "Daily pack claimed successfully!",
                "user_pack_id": new_pack.user_pack_id
            }), 201
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Database error while claiming pack for user {current_user_id}: {e}")
            return jsonify({"error": "Failed to create your daily pack"}), 500
        
    except Exception as e:
        current_app.logger.error(f"Error in claim daily pack for user {current_user_id}: {e}")
        return jsonify({"error": "An error occurred while processing your request"}), 500


# Admin route to manually trigger daily pack generation
@packs_bp.route('/admin/generate-daily-packs', methods=['POST'])
@jwt_required()
def admin_generate_daily_packs():
    """
    Admin endpoint to manually trigger the daily pack generation.
    """
    current_user_id = get_jwt_identity()
    
    # Check if user is an admin (assuming you have a role field)
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized: Admin access required"}), 403
    
    try:
        # Call the generate_daily_packs function
        success_count = generate_daily_packs()
        
        return jsonify({
            "message": f"Pack generation complete. {success_count} new packs created."
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in manual pack generation: {e}")
        return jsonify({"error": "An error occurred during pack generation."}), 500


# Admin route to generate a pack for a specific user
@packs_bp.route('/admin/generate-user-pack', methods=['POST'])
@jwt_required()
def admin_generate_user_pack():
    """
    Admin endpoint to manually generate a pack for a specific user.
    """
    current_user_id = get_jwt_identity()
    
    # Check if user is an admin
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized: Admin access required"}), 403
    
    # Get the target user ID from the request
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({"error": "Missing user_id parameter"}), 400
    
    target_user_id = data.get('user_id')
    
    try:
        # Call the function to generate a pack for this user
        from server.services.scheduler_service import generate_pack_for_user
        new_pack = generate_pack_for_user(target_user_id)
        
        if new_pack:
            return jsonify({
                "message": f"Pack successfully generated for user {target_user_id}",
                "user_pack_id": new_pack.user_pack_id
            }), 201
        else:
            return jsonify({
                "error": f"Failed to generate pack for user {target_user_id}"
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"Error generating pack for user {target_user_id}: {e}")
        return jsonify({"error": "An error occurred during pack generation"}), 500


# Admin route to check for missing daily packs and recover them
@packs_bp.route('/admin/check-missing-packs', methods=['POST'])
@jwt_required()
def admin_check_missing_packs():
    """
    Admin endpoint to check for users who may have missed their daily packs
    and generate packs for them.
    """
    current_user_id = get_jwt_identity()
    
    # Check if user is an admin
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized: Admin access required"}), 403
    
    try:
        # Call the function to check for missing packs
        from server.services.scheduler_service import check_missing_daily_packs
        recovered_count = check_missing_daily_packs()
        
        return jsonify({
            "message": f"Missing pack check complete. {recovered_count} packs recovered."
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error checking for missing packs: {e}")
        return jsonify({"error": "An error occurred during missing pack check"}), 500


# Admin route to get daily pack statistics
@packs_bp.route('/admin/pack-stats', methods=['GET'])
@jwt_required()
def admin_get_pack_stats():
    """
    Admin endpoint to get statistics about daily pack distribution.
    """
    current_user_id = get_jwt_identity()
    
    # Check if user is an admin
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized: Admin access required"}), 403
    
    try:
        # Get the daily pack type
        daily_pack_type = PackType.query.filter_by(name="Daily Pack").first()
        if not daily_pack_type:
            return jsonify({"error": "Daily pack type not found"}), 404
        
        # Get today's date
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        # Count packs generated today
        packs_today = UserPack.query.filter(
            UserPack.pack_type_id == daily_pack_type.pack_type_id,
            UserPack.acquired_at >= today_start,
            UserPack.acquired_at <= today_end
        ).count()
        
        # Count total users
        total_users = User.query.count()
        
        # Count users who received a pack today
        users_with_packs_today = db.session.query(UserPack.user_id)\
            .filter(
                UserPack.pack_type_id == daily_pack_type.pack_type_id,
                UserPack.acquired_at >= today_start,
                UserPack.acquired_at <= today_end
            )\
            .distinct()\
            .count()
        
        # Count users who haven't received a pack in the last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        # This query is more complex, we need to find users who don't have a pack 
        # in the last 24 hours or have never received a pack
        
        # First, get users who have received a pack in the last 24 hours
        recent_pack_users = db.session.query(UserPack.user_id)\
            .filter(
                UserPack.pack_type_id == daily_pack_type.pack_type_id,
                UserPack.acquired_at >= yesterday
            )\
            .distinct()\
            .subquery()
        
        # Then count users who are not in that subquery
        users_missing_packs = User.query.filter(
            ~User.user_id.in_(db.session.query(recent_pack_users))
        ).count()
        
        return jsonify({
            "total_users": total_users,
            "packs_generated_today": packs_today,
            "users_with_packs_today": users_with_packs_today,
            "users_missing_recent_packs": users_missing_packs,
            "coverage_percentage": round((users_with_packs_today / total_users) * 100, 2) if total_users > 0 else 0
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching pack statistics: {e}")
        return jsonify({"error": "An error occurred while fetching pack statistics"}), 500


# Admin route to check scheduler status and manually trigger a job
@packs_bp.route('/admin/scheduler-status', methods=['GET', 'POST'])
@jwt_required()
def admin_scheduler_status():
    """
    Admin endpoint to check the status of the scheduler and manually trigger jobs.
    GET: Returns the status of the scheduler and scheduled jobs
    POST: Manually triggers a job (daily_pack_generation or check_missing_packs)
    """
    current_user_id = get_jwt_identity()
    
    # Check if user is an admin
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized: Admin access required"}), 403
    
    from flask import current_app
    
    if request.method == 'GET':
        # Get status of scheduler
        try:
            from server.app import scheduler
            
            # Get all jobs
            jobs = []
            for job in scheduler.get_jobs():
                jobs.append({
                    "id": job.id,
                    "name": job.name,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger)
                })
            
            return jsonify({
                "scheduler_running": scheduler.running,
                "jobs": jobs,
                "server_time_utc": datetime.utcnow().isoformat()
            }), 200
            
        except Exception as e:
            current_app.logger.error(f"Error getting scheduler status: {e}")
            return jsonify({"error": "An error occurred while checking scheduler status"}), 500
    
    elif request.method == 'POST':
        # Run a job manually
        data = request.get_json()
        if not data or 'job_id' not in data:
            return jsonify({"error": "Missing job_id parameter"}), 400
        
        job_id = data.get('job_id')
        allowed_jobs = ['daily_pack_generation', 'check_missing_packs']
        
        if job_id not in allowed_jobs:
            return jsonify({"error": f"Invalid job_id. Must be one of: {', '.join(allowed_jobs)}"}), 400
        
        try:
            from server.app import scheduler
            
            # Get the job function
            if job_id == 'daily_pack_generation':
                from server.services.scheduler_service import generate_daily_packs
                result = generate_daily_packs()
                job_result = f"Created {result} packs"
            elif job_id == 'check_missing_packs':
                from server.services.scheduler_service import check_missing_daily_packs
                result = check_missing_daily_packs()
                job_result = f"Recovered {result} packs"
            
            return jsonify({
                "message": f"Job '{job_id}' executed successfully",
                "result": job_result,
                "timestamp": datetime.utcnow().isoformat()
            }), 200
            
        except Exception as e:
            current_app.logger.error(f"Error executing job {job_id}: {e}")
            return jsonify({"error": f"An error occurred while executing job '{job_id}'"}), 500


# Route definition uses the prefix from app.py registration + '/user-packs/...'
@packs_bp.route('/user-packs/<int:user_pack_id>/open', methods=['POST'])
@jwt_required()
def open_user_pack(user_pack_id):
    current_user_id = get_jwt_identity() # Get user ID from JWT token

    # --- SIMPLIFIED LOGIC ---
    NUM_ARTWORKS_TO_GIVE = 3 # Hardcode how many artworks to give for now
    # ------------------------

    selected_artworks_for_pack = []
    try:
        # Use a transaction for atomicity
        with db.session.begin_nested():
            # 1. Fetch UserPack instance & validate ownership/status
            pack_instance = db.session.get(UserPack, user_pack_id)

            if not pack_instance:
                return jsonify({"error": "Pack not found"}), 404
            # Make sure to use the correct user ID field from your User model (user_id)
            if pack_instance.owner.user_id != current_user_id: # Check via relationship or pack_instance.user_id
                return jsonify({"error": "Forbidden: You do not own this pack"}), 403
            if pack_instance.opened_at is not None:
                return jsonify({"error": "Conflict: Pack already opened"}), 409

            # 2. Get IDs of artworks the user *already* owns
            owned_artwork_ids_query = db.session.query(Collection.artwork_id)\
                                              .filter(Collection.patron_id == current_user_id)
            # Assuming Collection model uses 'patron_id' based on your earlier snippet
            owned_artwork_ids = {artwork_id for (artwork_id,) in owned_artwork_ids_query.all()}

            # 3. Select random artworks the user does NOT own (ignore rarity for now)
            # Using Artwork.artwork_id from your Artwork model
            selected_artworks_for_pack = Artwork.query.filter(
                not_(Artwork.artwork_id.in_(owned_artwork_ids)) # Exclude owned IDs
            ).order_by(func.random()).limit(NUM_ARTWORKS_TO_GIVE).all()

            # Handle case where not enough *new* artworks are available
            if not selected_artworks_for_pack:
                # If absolutely NO new artworks could be found
                print(f"Warning: No unowned artworks found for user {current_user_id} to open pack {user_pack_id}.")
                # Decide: Error out? Or return success with empty list? Let's error for now.
                raise ValueError("No new artworks available to award for this pack.")
            elif len(selected_artworks_for_pack) < NUM_ARTWORKS_TO_GIVE:
                # If fewer than requested were found, just proceed with what we got
                print(f"Warning: Could only find {len(selected_artworks_for_pack)} unowned artworks (requested {NUM_ARTWORKS_TO_GIVE}) for user {current_user_id}.")


            # 4. Add selected artworks to user's collection
            for art in selected_artworks_for_pack:
                new_collection_item = Collection(
                    patron_id=current_user_id, # Use 'patron_id'
                    artwork_id=art.artwork_id
                )
                db.session.add(new_collection_item)

            # 5. Mark the pack instance as opened
            pack_instance.opened_at = datetime.utcnow()
            db.session.add(pack_instance)

        # Commit transaction if 'with' block succeeded
        db.session.commit()

        # 6. Prepare response data
        artwork_details = [
            {
                "artwork_id": art.artwork_id,
                "title": art.title,
                "image_url": art.image_url,
                "rarity": art.rarity, # Still include rarity if available
                "artist": {"user_id": art.artist.user_id, "username": art.artist.username}
            }
            for art in selected_artworks_for_pack
        ]

        return jsonify({
            "message": "Pack opened successfully!",
            "artworks_received": artwork_details
        }), 200

    except ValueError as ve: # Catch specific errors like no artworks available
        db.session.rollback()
        print(f"Value Error opening pack {user_pack_id}: {ve}")
        # Return 400 or maybe 409 Conflict if no new items are available? 400 is reasonable.
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error opening pack {user_pack_id}: {e}") # Log the full error server-side
        return jsonify({"error": "An internal error occurred while opening the pack."}), 500