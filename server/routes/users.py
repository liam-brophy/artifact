from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, current_user as jwt_current_user
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload # For eager loading if needed
import traceback 

# Import necessary models
from server.models.user import User
from server.models.artwork import Artwork
from server.models.collection import Collection
from server.models.user_follow import UserFollow
from server.app import db # Import db instance

users_bp = Blueprint('users', __name__)

# --- Constants ---
DEFAULT_PAGE_LIMIT = 20
MAX_PAGE_LIMIT = 100

# --- Helper for Pagination Args ---
def get_pagination_args():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', DEFAULT_PAGE_LIMIT, type=int)
    limit = max(1, min(limit, MAX_PAGE_LIMIT)) # Clamp limit
    return page, limit

# --- NEW: Endpoint to get public user profile by username ---
@users_bp.route('/<string:username>', methods=['GET'])
@jwt_required(optional=True) # Allow anonymous access, but check identity if token exists
def get_user_profile(username):
    """Gets public profile data for a user by username."""
    current_user_id = get_jwt_identity() # Returns None if no valid token

    # Fetch the user by username
    # Use first_or_404 to handle not found cleanly
    user = User.query.filter_by(username=username).first_or_404(
        description=f"User with username '{username}' not found."
    )

    # --- Calculate Follower and Following Counts ---
    # Count users following this user (where user.user_id is the followed/artist_id)
    follower_count = UserFollow.query.filter_by(artist_id=user.user_id).count()

    # Count users this user is following (where user.user_id is the follower/patron_id)
    following_count = UserFollow.query.filter_by(patron_id=user.user_id).count()

    # --- Determine if the current logged-in user is following this profile user ---
    is_following = False
    if current_user_id and current_user_id != user.user_id:
        # Check if a follow relationship exists from current_user to this profile user
        follow_exists = UserFollow.query.filter_by(
            patron_id=current_user_id, # Logged-in user is the follower
            artist_id=user.user_id     # Profile user is the followed
        ).first() is not None
        is_following = follow_exists

    # --- Serialize Public Profile Data ---
    # Define fields safe for public view
    public_fields = ("user_id", "username", "role", "profile_image_url", "bio", "created_at")
    profile_data = user.to_dict(only=public_fields)

    # Add calculated counts and follow status
    profile_data['follower_count'] = follower_count
    profile_data['following_count'] = following_count
    profile_data['isFollowing'] = is_following # Will be false if not logged in or viewing self

    return jsonify(profile_data), 200


# === POST /api/users/<target_user_id>/follow ===
# Allows the authenticated user to follow another user (target_user_id)
@users_bp.route('/<int:target_user_id>/follow', methods=['POST'])
@jwt_required()
def follow_user(target_user_id):
    """Allows the authenticated user to follow the target user."""
    current_user_id = get_jwt_identity()

    # Check if target user exists
    target_user = User.query.get_or_404(target_user_id, description="Target user to follow not found.")

    # Prevent self-follow
    if current_user_id == target_user_id:
        return jsonify({"error": {"code": "FOLLOW_004", "message": "Cannot follow yourself."}}), 400

    # Check if already following
    exists = UserFollow.query.filter_by(
        patron_id=current_user_id,  # Current user is the follower
        artist_id=target_user_id    # Target user is the followed
    ).first()
    if exists:
        return jsonify({"error": {"code": "FOLLOW_001", "message": "You are already following this user."}}), 409 # 409 Conflict

    # Create the follow relationship
    new_follow = UserFollow(patron_id=current_user_id, artist_id=target_user_id)

    try:
        db.session.add(new_follow)
        db.session.commit()
    except IntegrityError: # Should be caught by the check above, but belt-and-suspenders
        db.session.rollback()
        return jsonify({"error": {"code": "FOLLOW_001", "message": "You are already following this user (database constraint)."}}), 409
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error creating follow - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not follow user due to database error"}}), 500

    # Return success - 201 Created is suitable
    return jsonify({"message": f"Successfully followed user {target_user.username}"}), 201


# === DELETE /api/users/<target_user_id>/follow ===
# Allows the authenticated user to unfollow another user (target_user_id)
@users_bp.route('/<int:target_user_id>/follow', methods=['DELETE'])
@jwt_required()
def unfollow_user(target_user_id):
    """Allows the authenticated user to unfollow the target user."""
    current_user_id = get_jwt_identity()

    # Check if target user exists (optional but good practice)
    # User.query.get_or_404(target_user_id, description="Target user to unfollow not found.")

    # Prevent self-unfollow attempt (logically shouldn't happen)
    if current_user_id == target_user_id:
       return jsonify({"error": {"code": "FOLLOW_005", "message": "Cannot unfollow yourself."}}), 400

    # Find the follow relationship
    follow_rel = UserFollow.query.filter_by(
        patron_id=current_user_id, # Current user is the follower
        artist_id=target_user_id   # Target user is the followed
    ).first()

    # If relationship doesn't exist, return 404
    if not follow_rel:
        return jsonify({"error": {"code": "FOLLOW_002", "message": "Follow relationship not found."}}), 404

    # Delete the relationship
    try:
        db.session.delete(follow_rel)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error deleting follow - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not unfollow user due to database error"}}), 500

    # Return success - 204 No Content is standard for successful DELETE
    return '', 204


# === GET /api/users/:user_id/following ===
# Gets the list of users that the specified :user_id is following.
@users_bp.route('/<int:user_id>/following', methods=['GET'])
@jwt_required() # Require login to view any following list for now
def get_following_list(user_id):
    """Gets the list of users the specified user is following."""
    current_user_id = get_jwt_identity()

    # --- Authorization: Allow viewing only own list for now ---
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view following list for another user."}}), 403

    # Check if the user whose list is requested exists
    user = User.query.get_or_404(user_id, description="User not found.")

    # --- Pagination ---
    page, limit = get_pagination_args()

    # Query users followed by 'user_id'
    # We need UserFollow where patron_id = user_id, and we want the User details where User.user_id = UserFollow.artist_id
    pagination = db.session.query(UserFollow, User)\
                           .join(User, UserFollow.artist_id == User.user_id)\
                           .filter(UserFollow.patron_id == user_id)\
                           .order_by(UserFollow.created_at.desc())\
                           .paginate(page=page, per_page=limit, error_out=False)

    follow_items = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages

    # --- Serialization ---
    # We want details of the user being *followed* (the 'artist' in the join)
    following_data = []
    for follow_rel, followed_user in follow_items:
        user_data = followed_user.to_dict(only=["user_id", "username", "profile_image_url", "role"]) # Add role maybe?
        # Include when the follow happened
        user_data["followed_at"] = follow_rel.created_at.isoformat() + 'Z' if follow_rel.created_at else None
        following_data.append(user_data)

    response = {
        # Changed key to 'users' for consistency, or keep 'following'? Let's keep 'following' for clarity
        "following": following_data,
        "pagination": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit
        }
    }
    return jsonify(response), 200


# === GET /api/users/:user_id/followers ===
# Gets the list of users following the specified :user_id.
@users_bp.route('/<int:user_id>/followers', methods=['GET'])
@jwt_required() # Require login to view any follower list for now
def get_followers_list(user_id):
    """Gets the list of users following the specified user."""
    current_user_id = get_jwt_identity()

    # --- Authorization: Allow viewing only own list for now ---
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view followers list for another user."}}), 403

    # Check if the user whose list is requested exists
    user = User.query.get_or_404(user_id, description="User not found.")

    # --- Pagination ---
    page, limit = get_pagination_args()

    # Query users following 'user_id'
    # We need UserFollow where artist_id = user_id, and we want the User details where User.user_id = UserFollow.patron_id
    pagination = db.session.query(UserFollow, User)\
                           .join(User, UserFollow.patron_id == User.user_id)\
                           .filter(UserFollow.artist_id == user_id)\
                           .order_by(UserFollow.created_at.desc())\
                           .paginate(page=page, per_page=limit, error_out=False)

    follower_items = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages

    # --- Serialization ---
    # We want details of the user who is *following* (the 'patron' in the join)
    followers_data = []
    for follow_rel, follower_user in follower_items:
        user_data = follower_user.to_dict(only=["user_id", "username", "profile_image_url", "role"]) # Add role maybe?
        # Include when the follow happened
        user_data["followed_at"] = follow_rel.created_at.isoformat() + 'Z' if follow_rel.created_at else None
        followers_data.append(user_data)

    response = {
        # Changed key to 'users' or keep 'followers'? Let's keep 'followers'
        "followers": followers_data,
        "pagination": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit
        }
    }
    return jsonify(response), 200


# --- Existing Artwork/Collection Routes (Keep as they are role-specific) ---
# === GET /api/users/:user_id/created-artworks === (Now Publicly Viewable for Artists)
@users_bp.route('/<int:user_id>/created-artworks', methods=['GET'])
# Use optional=True so the route works even if no token is sent
# We can still check for a viewer later if needed
@jwt_required(optional=True)
def get_user_created_artworks(user_id):
    """Gets artworks created by a specific artist (publicly viewable)."""
    # viewer_id = get_jwt_identity() # Get ID if logged in, None otherwise

    # Fetch the user whose artworks we want to view
    # Check if user exists first before checking role
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found"}}), 404

    # --- Role Check: Ensure the profile user IS an artist ---
    if user.role != 'artist':
         return jsonify({"error": {"code": "NOT_FOUND", "message": "No artist profile found for this user."}}), 404

    # --- Pagination ---
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        per_page = max(1, min(per_page, 100)) # Clamp per_page
    except Exception as e:
        # Should ideally not happen with type=int, but good practice
        current_app.logger.error(f"Error parsing pagination params: {e}")
        return jsonify({"error": "Invalid pagination parameters"}), 400

    # --- Query and Serialization ---
    # <<< Start TRY block HERE >>>
    try:
        pagination = Artwork.query.filter_by(artist_id=user_id)\
            .options(joinedload(Artwork.artist)).order_by(Artwork.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        artworks = pagination.items

        # Adjust serialization rules based on what ArtworkCard component needs
        artworks_data = [aw.to_dict(rules=(
            '-collections', # Exclude potentially large list
            'artist.user_id',
            'artist.username'
            # Ensure other needed fields like artwork_id, title, image_url, etc., are included by default or added here
            # Or use 'only=(...)' if that's easier
        )) for aw in artworks]

        response = {
            "artworks": artworks_data,
            "pagination": {
                "totalItems": pagination.total,
                "totalPages": pagination.pages,
                "currentPage": pagination.page,
                "perPage": pagination.per_page,
                "hasNext": pagination.has_next,
                "hasPrev": pagination.has_prev,
             }
        }
        return jsonify(response), 200

    # <<< End TRY block HERE >>>
    except Exception as e:
         # Log the detailed error
         error_traceback = traceback.format_exc()
         current_app.logger.error(f"Error fetching/processing created artworks for artist {user_id}:\n{error_traceback}")
         return jsonify({"error": "An internal server error occurred while fetching artworks."}), 500
    

# === GET /api/users/:user_id/collected-artworks ===
@users_bp.route('/<int:user_id>/collected-artworks', methods=['GET'])
@jwt_required() # Keep this if only the owner can see their own full collection list
def get_user_collected_artworks(user_id):
    """Gets artworks collected by a specific user (checks ownership)."""
    print(f"--- Request received for collected artworks: user_id={user_id} ---") # DEBUG
    current_user_id = get_jwt_identity()

    # Authorization check: Ensure the logged-in user matches the requested user ID
    if current_user_id != user_id:
        print(f"Authorization failed: current_user={current_user_id}, requested_user={user_id}") # DEBUG
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view collection for another user."}}), 403

    # Fetch the user or return 404
    user = User.query.get(user_id) # Use get for primary key lookup
    if not user:
         print(f"User not found for user_id={user_id}") # DEBUG
         # Use standard 404 error handler if configured, or return JSON
         return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found"}}), 404

    # Optional: Check if the user role allows having a collection (if needed)
    # if user.role != 'patron':
    #     print(f"Role check failed: user_id={user_id}, role={user.role}") # DEBUG
    #     return jsonify({"error": {"code": "AUTH_006", "message": "User must be a patron to have a collection."}}), 403

    # --- Pagination ---
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        # Clamp per_page to reasonable limits
        per_page = max(1, min(per_page, 100))
        print(f"Pagination parameters: page={page}, per_page={per_page}") # DEBUG
    except Exception as e:
        print(f"Error parsing pagination parameters: {e}") # DEBUG
        return jsonify({"error": "Invalid pagination parameters"}), 400

    try:
        # --- Query using the relationship with eager loading ---
        # Make sure the 'collections' relationship on the User model is correctly defined
        # and back_populates with 'patron' on the Collection model.
        # Assuming 'user.collections' is configured (e.g., lazy='dynamic' or default lazy='select')
        # If lazy='dynamic', you query from it. If lazy='select', it's a list you might paginate differently.
        # Let's assume the dynamic approach which is common for pagination:
        base_query = user.collections # This should be the Query object if lazy='dynamic'

        # Check if base_query is indeed a query object (for debugging if relationship isn't dynamic)
        print(f"Type of user.collections: {type(base_query)}") # DEBUG

        pagination = base_query.options(
                # Eager load Artwork data, and within that, the Artist data
                joinedload(Collection.artwork).joinedload(Artwork.artist)
            )\
            .order_by(Collection.acquired_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False) # error_out=False is important

        print(f"Pagination total items found in DB query: {pagination.total}") # DEBUG
        print(f"Pagination items on this page (count from pagination object): {len(pagination.items)}") # DEBUG

        # --- Process Items for Response ---
        collection_items = pagination.items # Get items for the current page
        final_collection_list = []

        print(f"Starting processing loop for {len(collection_items)} items...") # DEBUG
        for i, item in enumerate(collection_items):
            # Basic check on the item type
            if not isinstance(item, Collection):
                 print(f"  Item {i} is not a Collection object, skipping. Type: {type(item)}") # DEBUG
                 continue

            print(f"  Processing item {i}: patron_id={item.patron_id}, artwork_id={item.artwork_id}") # DEBUG

            # Check if the related artwork object was loaded
            if not item.artwork:
                 print(f"  Skipping item {i} because item.artwork is missing! (artwork_id={item.artwork_id})") # DEBUG
                 continue

            print(f"    Artwork loaded: artwork_id={item.artwork.artwork_id}, title='{item.artwork.title}'") # DEBUG

            # Prepare artwork data using serialization (adjust fields as needed)
            artwork_data = item.artwork.to_dict(
                only=[
                    "artwork_id", "title", "image_url", "thumbnail_url", "rarity"
                ]
            )

            # Prepare artist data safely
            artist_data = {}
            if item.artwork.artist:
                 print(f"    Artist loaded: user_id={item.artwork.artist.user_id}, username='{item.artwork.artist.username}'") # DEBUG
                 artist_data = item.artwork.artist.to_dict(only=["user_id", "username"])
            else:
                 print(f"    Artist relationship missing for artwork_id={item.artwork.artwork_id}") # DEBUG


            # Append the structured data to the response list
            final_collection_list.append({
                "artwork": artwork_data,
                "artist": artist_data,
                "acquired_at": item.acquired_at.isoformat() + 'Z' if item.acquired_at else None,
                "transaction_id": item.transaction_id
                # We don't need collection_id as it doesn't exist
            })

        print(f"Finished processing loop. Final list length: {len(final_collection_list)}") # DEBUG

        # --- Prepare Final JSON Response ---
        response = {
            "collectedArtworks": final_collection_list,
            "pagination": {
                "totalItems": pagination.total,
                "totalPages": pagination.pages,
                "currentPage": pagination.page, # Use page from pagination object
                "perPage": pagination.per_page, # Use per_page from pagination object
                "hasNext": pagination.has_next,
                "hasPrev": pagination.has_prev,
            }
        }
        return jsonify(response), 200

    except Exception as e:
        # Log the detailed error including traceback
        error_traceback = traceback.format_exc()
        current_app.logger.error(f"Exception occurred in get_user_collected_artworks for user {user_id}:\n{error_traceback}")
        print(f"!!! EXCEPTION OCCURRED: {e}\n{error_traceback}") # DEBUG - Also print to console
        return jsonify({"error": "An internal server error occurred while processing the collection."}), 500


# === POST /api/users/:user_id/collected-artworks === (Patron Only - Add to Own)
@users_bp.route('/<int:user_id>/collected-artworks', methods=['POST'])
@jwt_required()
def add_artwork_to_collection(user_id):
    """Adds an artwork to the specified user's (patron) collection."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
         return jsonify({"error": {"code": "AUTH_004", "message": "Cannot add to another user's collection."}}), 403

    user = User.query.get_or_404(user_id)
    if user.role != 'patron':
         return jsonify({"error": {"code": "AUTH_006", "message": "User must be a patron to add to a collection."}}), 403

    data = request.get_json()
    if not data or 'artwork_id' not in data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'artwork_id' in request body."}}), 400

    try:
        artwork_id = int(data['artwork_id'])
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "'artwork_id' must be an integer."}}), 400

    transaction_id = data.get('transaction_id') # Optional

    artwork = Artwork.query.get_or_404(artwork_id, description="Artwork to collect not found.")

    # Check if already in collection
    exists = Collection.query.filter_by(patron_id=current_user_id, artwork_id=artwork_id).first()
    if exists:
        return jsonify({"error": {"code": "COLLECTION_001", "message": "Artwork is already in this collection."}}), 409

    new_collection_item = Collection(patron_id=current_user_id, artwork_id=artwork_id, transaction_id=transaction_id)

    try:
        db.session.add(new_collection_item)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error adding to collection - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not add artwork to collection."}}), 500

    # Serialize response data
    response_data = new_collection_item.to_dict(rules=('-patron', '-artwork')) # Adjust rules as needed
    response_data['artwork_id'] = artwork_id # Add back for clarity if needed
    response_data['patron_id'] = current_user_id # Add back for clarity if needed
    response_data['acquired_at'] = new_collection_item.acquired_at.isoformat() + 'Z' if new_collection_item.acquired_at else None

    return jsonify(response_data), 201


# === DELETE /api/users/:user_id/collected-artworks/:artwork_id === (Patron Only - Remove from Own)
@users_bp.route('/<int:user_id>/collected-artworks/<int:artwork_id>', methods=['DELETE'])
@jwt_required()
def remove_artwork_from_collection(user_id, artwork_id):
    """Removes an artwork from the specified user's (patron) collection."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
         return jsonify({"error": {"code": "AUTH_004", "message": "Cannot remove from another user's collection."}}), 403

    user = User.query.get_or_404(user_id)
    if user.role != 'patron':
        return jsonify({"error": {"code": "AUTH_006", "message": "User must be a patron to manage a collection."}}), 403

    collection_item = Collection.query.filter_by(patron_id=current_user_id, artwork_id=artwork_id).first()
    if not collection_item:
        return jsonify({"error": {"code": "COLLECTION_003", "message": "Artwork not found in this user's collection."}}), 404

    try:
        db.session.delete(collection_item)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error removing from collection - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not remove artwork from collection."}}), 500

    return '', 204


# === PATCH /api/users/:user_id/preferences === (Update User Preferences)
@users_bp.route('/<int:user_id>/preferences', methods=['PATCH'])
@jwt_required()
def update_user_preferences(user_id):
    """Updates user preferences including favorite color."""
    current_user_id = get_jwt_identity()

    # Only allow users to update their own preferences
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot update another user's preferences."}}), 403

    # Get the user
    user = User.query.get_or_404(user_id)
    
    # Get the request data
    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No data provided."}}), 400
    
    # Update favorite color if provided
    if 'favorite_color' in data:
        # Validate the color format (basic validation for hex color)
        color = data['favorite_color']
        if color and not (color.startswith('#') and len(color) in [4, 7, 9]):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid color format. Expected hex color (e.g., #FF5500)."}}), 400
        
        user.favorite_color = color
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error updating user preferences - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not update user preferences."}}), 500
    
    # Return the updated user preferences
    return jsonify({
        "message": "User preferences updated successfully",
        "preferences": {
            "favorite_color": user.favorite_color
        }
    }), 200