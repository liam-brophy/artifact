from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.sql.expression import func # For random()
from sqlalchemy import not_ # For WHERE NOT IN
from datetime import datetime

# Import your models and db session
from server.app import db
from server.models.user import User
from server.models.artwork import Artwork
from server.models.collection import Collection
from server.models.pack_type import PackType
from server.models.user_pack import UserPack

packs_bp = Blueprint('packs', __name__, url_prefix='/api')

@packs_bp.route('/user-packs/<int:user_pack_id>/open', methods=['POST'])
@jwt_required()
def open_user_pack(user_pack_id):
    current_user_id = get_jwt_identity() # Get user ID from JWT token

    selected_artworks_for_pack = []
    try:
        # Use a transaction for atomicity
        with db.session.begin_nested(): # Or db.session.begin() if not nested
            # 1. Fetch UserPack instance & validate ownership/status
            pack_instance = db.session.get(UserPack, user_pack_id)

            if not pack_instance:
                return jsonify({"error": "Pack not found"}), 404
            if pack_instance.user_id != current_user_id:
                return jsonify({"error": "Forbidden: You do not own this pack"}), 403
            if pack_instance.opened_at is not None:
                return jsonify({"error": "Conflict: Pack already opened"}), 409

            # 2. Fetch the PackType and its recipe
            pack_type = db.session.get(PackType, pack_instance.pack_type_id)
            if not pack_type or not isinstance(pack_type.recipe, dict):
                 # Log this error - should not happen with proper data
                 print(f"Error: PackType {pack_instance.pack_type_id} missing or recipe invalid.")
                 raise ValueError("Pack configuration error.") # Internal error

            recipe = pack_type.recipe # e.g., {"common": 3, "uncommon": 2, "rare": 1}

            # 3. Get IDs of artworks the user *already* owns
            owned_artwork_ids_query = db.session.query(Collection.artwork_id)\
                                              .filter(Collection.patron_id == current_user_id)
            owned_artwork_ids = {artwork_id for (artwork_id,) in owned_artwork_ids_query.all()}

            # 4. Select artworks based on recipe, excluding owned ones
            selected_artworks_for_pack = []
            possible_to_fulfill = True # Flag to track if we found enough

            for rarity, count in recipe.items():
                if count <= 0: # Skip if recipe asks for 0 of a rarity
                    continue

                # Find 'count' artworks of this 'rarity' that the user does NOT own
                candidates = Artwork.query.filter(
                    Artwork.rarity == rarity,
                    not_(Artwork.artwork_id.in_(owned_artwork_ids)) # Exclude owned IDs
                ).order_by(func.random()).limit(count).all() # Random selection within candidates

                # --- Crucial Check: Did we find enough? ---
                if len(candidates) < count:
                    # PROBLEM: Not enough unowned artworks of this rarity exist!
                    # Decision needed:
                    # Option A: Fail the entire pack opening? (Safest?)
                    # Option B: Give fewer items than promised? (Might be okay?)
                    # Option C: Log warning and continue with what was found?
                    print(f"Warning: Needed {count} unowned '{rarity}' artworks for user {current_user_id}, but only found {len(candidates)}.")
                    # For now, let's flag it and potentially fail later or proceed with fewer items
                    possible_to_fulfill = False # Or handle immediately based on product decision
                    # Example: Fail immediately
                    # raise ValueError(f"Cannot fulfill pack recipe: Insufficient unowned '{rarity}' artworks.")

                selected_artworks_for_pack.extend(candidates)
                # Add the newly selected IDs to the owned set *temporarily*
                # to prevent selecting the same artwork twice if the recipe
                # asks for multiple items of the same rarity in THIS pack opening.
                owned_artwork_ids.update(art.artwork_id for art in candidates)

            # --- Handle potential failure if recipe couldn't be met ---
            # Re-evaluate based on your chosen strategy for the "Crucial Check" above
            if not possible_to_fulfill:
                 # Example: If you decided to fail if *any* part couldn't be met
                 # raise ValueError("Pack recipe could not be fully satisfied due to insufficient available artworks.")
                 # Or if you decided to proceed with fewer items, just continue.
                 pass # Assuming we proceed with what we found


            # 5. Add selected artworks to user's collection
            if not selected_artworks_for_pack:
                 # Maybe raise error if NO artworks were selected at all?
                 raise ValueError("No artworks selected for the pack, check recipe and availability.")

            for art in selected_artworks_for_pack:
                new_collection_item = Collection(
                    patron_id=current_user_id,
                    artwork_id=art.artwork_id
                    # acquired_at is handled by default
                )
                db.session.add(new_collection_item)

            # 6. Mark the pack instance as opened
            pack_instance.opened_at = datetime.utcnow()
            db.session.add(pack_instance)

        # If the 'with' block succeeded, commit the transaction
        db.session.commit()

        # 7. Prepare response data
        artwork_details = [
            {
                "artwork_id": art.artwork_id,
                "title": art.title,
                "image_url": art.image_url, # Or thumbnail_url
                "rarity": art.rarity,
                "artist": {"user_id": art.artist.user_id, "username": art.artist.username} # Example artist info
            }
            for art in selected_artworks_for_pack
        ]

        return jsonify({
            "message": "Pack opened successfully!",
            "artworks_received": artwork_details
        }), 200

    except ValueError as ve: # Catch specific errors like recipe failure
        db.session.rollback()
        print(f"Value Error opening pack {user_pack_id}: {ve}")
        return jsonify({"error": str(ve)}), 400 # Bad request (e.g., couldn't fulfill)
    except Exception as e:
        db.session.rollback()
        print(f"Error opening pack {user_pack_id}: {e}") # Log the full error server-side
        return jsonify({"error": "An internal error occurred while opening the pack."}), 500

# --- Register Blueprint ---
# In your main app file (e.g., server/app.py or server/__init__.py)
# from .routes.pack_routes import packs_bp
# app.register_blueprint(packs_bp)