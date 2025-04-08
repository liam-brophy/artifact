from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.sql.expression import func # For random()
from sqlalchemy import not_ # For WHERE NOT IN
from datetime import datetime

# Import your models and db session
from server.app import db
from server.models.user import User       # Assuming models are in server.models.*
from server.models.artwork import Artwork
from server.models.collection import Collection
from server.models.pack_type import PackType # Still needed for FK constraint
from server.models.user_pack import UserPack

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
        # Log the error for debugging
        # Assuming you have app logging configured in app.py (current_app)
        # from flask import current_app
        # current_app.logger.error(f"Error fetching user packs for user {current_user_id}: {e}")
        print(f"Error fetching user packs for user {current_user_id}: {e}") # Simple print for now
        return jsonify({"error": "An internal error occurred while fetching packs."}), 500


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