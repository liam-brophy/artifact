from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from server.models.user import User
from server.models.artwork import Artwork  # Need Artwork model here
from server.models.collection import Collection  # Assuming a Collection model exists
from server.models.userfollow import UserFollow  # Assuming a UserFollow model exists
from server.app import db  # Potentially needed for pagination/complex queries

users_bp = Blueprint('users', __name__)


# --- Helper Function for Patron Check ---
def check_patron_role(user_id):
    user = User.query.get(user_id)
    if not user or user.role != 'patron':
        return False, jsonify({"error": {"code": "AUTH_004", "message": "Action requires patron role."}}), 403
    return True, user, None


# --- Helper Function for Artist Check (for target user) ---
def check_target_is_artist(user_id):
    user = User.query.get(user_id)
    if not user:
        return False, jsonify({"error": {"code": "USER_001", "message": "Target user not found."}}), 404
    if user.role != 'artist':
        return False, jsonify({"error": {"code": "FOLLOW_005", "message": "Target user is not an artist."}}), 400  # Use 400 Bad Request
    return True, user, None


# === GET /api/users/:user_id/created-artworks ===
@users_bp.route('/<int:user_id>/created-artworks', methods=['GET'])
@jwt_required()
def get_user_created_artworks(user_id):
    """Gets artworks created by a specific user (artist)."""
    current_user_id = get_jwt_identity()

    # --- Authorization ---
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view created artworks for another user."}}), 403

    user = User.query.get(user_id)
    if not user:
         return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404

    if user.role != 'artist':
         return jsonify({"error": {"code": "AUTH_004", "message": "User is not an artist."}}), 403
    # --- End Authorization ---

    # --- Pagination ---
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = max(1, min(limit, 100))

    pagination = Artwork.query.filter_by(artist_id=user_id)\
                              .order_by(Artwork.created_at.desc())\
                              .paginate(page=page, per_page=limit, error_out=False)

    artworks = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages
    # --- End Pagination ---

    # --- Serialization ---
    # Using .to_dict() with only argument to return the required fields.
    artworks_data = [
        artwork.to_dict(only=["artwork_id", "title", "description", "created_at"])
        for artwork in artworks
    ]
    # --- End Serialization ---

    response = {
        "artworks": artworks_data,
        "pagination": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit
        }
    }

    return jsonify(response), 200


# === GET /api/users/:user_id/collected-artworks ===
@users_bp.route('/<int:user_id>/collected-artworks', methods=['GET'])
@jwt_required()
def get_user_collected_artworks(user_id):
    """Gets artworks collected by a specific user (patron)."""
    current_user_id = get_jwt_identity()

    # --- Authorization: User can only view their own collection ---
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view collection for another user."}}), 403

    is_patron, user_or_error, status_code = check_patron_role(current_user_id)
    if not is_patron:
        user_exists = User.query.get(current_user_id)
        if not user_exists:
            return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404
        else:
            return user_or_error, status_code
    # --- End Authorization ---

    # --- Pagination ---
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = max(1, min(limit, 100))

    pagination = user_or_error.collections.order_by(Collection.acquired_at.desc())\
                                       .paginate(page=page, per_page=limit, error_out=False)

    collection_items = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages
    # --- End Pagination ---

    # --- Serialization ---
    # Using nested .to_dict() calls on related models to match the spec:
    # { "collection": [ { "artwork": {...}, "artist": {...}, "acquired_at": ... } ] }
    final_collection_list = []
    for item in collection_items:
        artwork_data = item.artwork.to_dict(only=["artwork_id", "title"])
        # Assuming the Artwork model includes an artist relationship.
        artist_data = {}
        if hasattr(item.artwork, 'artist') and item.artwork.artist:
            artist_data = item.artwork.artist.to_dict(only=["user_id", "username"])
        final_collection_list.append({
            "artwork": artwork_data,
            "artist": artist_data,
            "acquired_at": item.acquired_at.isoformat() + 'Z',
            "transaction_id": item.transaction_id
        })
    # --- End Serialization ---

    response = {
        "collection": final_collection_list,
        "pagination": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit
        }
    }
    return jsonify(response), 200


# === POST /api/users/:user_id/collected-artworks ===
@users_bp.route('/<int:user_id>/collected-artworks', methods=['POST'])
@jwt_required()
def add_artwork_to_collection(user_id):
    """Adds an artwork to the specified user's (patron) collection."""
    current_user_id = get_jwt_identity()

    # --- Authorization: User can only add to their own collection ---
    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot add to another user's collection."}}), 403

    is_patron, user_or_error, status_code = check_patron_role(current_user_id)
    if not is_patron:
         user_exists = User.query.get(current_user_id)
         if not user_exists:
             return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404
         else:
             return user_or_error, status_code
    # --- End Authorization ---

    data = request.get_json()
    if not data or 'artwork_id' not in data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'artwork_id' in request body."}}), 400

    artwork_id_str = data.get('artwork_id')
    transaction_id = data.get('transaction_id')  # Optional

    try:
        artwork_id = int(artwork_id_str)
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "'artwork_id' must be an integer."}}), 400

    artwork = Artwork.query.get(artwork_id)
    if not artwork:
        return jsonify({"error": {"code": "ARTWORK_001", "message": "Artwork not found."}}), 404

    # Check if already in collection
    exists = Collection.query.filter_by(patron_id=current_user_id, artwork_id=artwork_id).first()
    if exists:
        return jsonify({"error": {"code": "COLLECTION_001", "message": "Artwork is already in this collection."}}), 409

    new_collection_item = Collection(
        patron_id=current_user_id,
        artwork_id=artwork_id,
        transaction_id=transaction_id
    )

    try:
        db.session.add(new_collection_item)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": {"code": "COLLECTION_001", "message": "Artwork is already in this collection (database constraint)."}}), 409
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error adding to collection - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not add artwork to collection due to database error"}}), 500

    # --- Serialization for Response ---
    response_data = {
        "artwork": artwork.to_dict(only=["artwork_id", "title"]),
        "acquired_at": new_collection_item.acquired_at.isoformat() + 'Z',
        "transaction_id": new_collection_item.transaction_id
    }
    # --- End Serialization ---

    return jsonify(response_data), 201


# === DELETE /api/users/:user_id/collected-artworks/:artwork_id ===
@users_bp.route('/<int:user_id>/collected-artworks/<int:artwork_id>', methods=['DELETE'])
@jwt_required()
def remove_artwork_from_collection(user_id, artwork_id):
    """Removes an artwork from the specified user's (patron) collection."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot remove from another user's collection."}}), 403

    is_patron, user_or_error, status_code = check_patron_role(current_user_id)
    if not is_patron:
         user_exists = User.query.get(current_user_id)
         if not user_exists:
             return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404
         else:
             return user_or_error, status_code
    # --- End Authorization ---

    collection_item = Collection.query.filter_by(patron_id=current_user_id, artwork_id=artwork_id).first()

    if not collection_item:
        return jsonify({"error": {"code": "COLLECTION_003", "message": "Artwork not found in this user's collection."}}), 404

    try:
        db.session.delete(collection_item)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error removing from collection - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not remove artwork from collection due to database error"}}), 500

    return '', 204


# === POST /api/users/:user_id/following ===
@users_bp.route('/<int:user_id>/following', methods=['POST'])
@jwt_required()
def follow_artist(user_id):
    """Allows the authenticated user (patron) to follow an artist."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot perform follow action for another user."}}), 403

    is_patron, user_or_error, status_code = check_patron_role(current_user_id)
    if not is_patron:
         user_exists = User.query.get(current_user_id)
         if not user_exists:
             return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404
         else:
             return user_or_error, status_code
    # --- End Authorization ---

    data = request.get_json()
    if not data or 'artist_id' not in data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'artist_id' in request body."}}), 400

    artist_id_str = data.get('artist_id')

    try:
        artist_id = int(artist_id_str)
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "'artist_id' must be an integer."}}), 400

    if current_user_id == artist_id:
        return jsonify({"error": {"code": "FOLLOW_004", "message": "Cannot follow yourself."}}), 400

    is_target_artist, target_user_or_error, target_status_code = check_target_is_artist(artist_id)
    if not is_target_artist:
        return target_user_or_error, target_status_code

    exists = UserFollow.query.filter_by(patron_id=current_user_id, artist_id=artist_id).first()
    if exists:
        return jsonify({"error": {"code": "FOLLOW_001", "message": "You are already following this artist."}}), 409

    new_follow = UserFollow(patron_id=current_user_id, artist_id=artist_id)

    try:
        db.session.add(new_follow)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": {"code": "FOLLOW_001", "message": "You are already following this artist (database constraint)."}}), 409
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error creating follow - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not follow artist due to database error"}}), 500

    # --- Serialization for Response ---
    response_data = {
        "artist": target_user_or_error.to_dict(only=["user_id", "username"]),
        "followed_at": new_follow.created_at.isoformat() + 'Z'
    }
    # --- End Serialization ---

    return jsonify(response_data), 201


# === DELETE /api/users/:user_id/following/:artist_id ===
@users_bp.route('/<int:user_id>/following/<int:artist_id>', methods=['DELETE'])
@jwt_required()
def unfollow_artist(user_id, artist_id):
    """Allows the authenticated user (patron) to unfollow an artist."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot perform unfollow action for another user."}}), 403

    is_patron, user_or_error, status_code = check_patron_role(current_user_id)
    if not is_patron:
         user_exists = User.query.get(current_user_id)
         if not user_exists:
             return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404
         else:
             return user_or_error, status_code
    # --- End Authorization ---

    follow_rel = UserFollow.query.filter_by(patron_id=current_user_id, artist_id=artist_id).first()

    if not follow_rel:
        return jsonify({"error": {"code": "FOLLOW_002", "message": "Follow relationship not found."}}), 404

    try:
        db.session.delete(follow_rel)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error deleting follow - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not unfollow artist due to database error"}}), 500

    return '', 204


# === GET /api/users/:user_id/following ===
@users_bp.route('/<int:user_id>/following', methods=['GET'])
@jwt_required()
def get_following_list(user_id):
    """Gets the list of artists the specified user (patron) is following."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view following list for another user."}}), 403

    user = User.query.get(current_user_id)
    if not user:
         return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404

    # --- Pagination ---
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = max(1, min(limit, 100))

    pagination = db.session.query(UserFollow, User)\
                           .join(User, UserFollow.artist_id == User.user_id)\
                           .filter(UserFollow.patron_id == current_user_id)\
                           .order_by(UserFollow.created_at.desc())\
                           .paginate(page=page, per_page=limit, error_out=False)

    follow_items = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages
    # --- End Pagination ---

    # --- Serialization ---
    following_data = []
    for follow_rel, artist in follow_items:
        artist_data = artist.to_dict(only=["user_id", "username", "profile_image_url"])
        artist_data["followed_at"] = follow_rel.created_at.isoformat() + 'Z' if follow_rel.created_at else None
        following_data.append(artist_data)
    # --- End Serialization ---

    response = {
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
@users_bp.route('/<int:user_id>/followers', methods=['GET'])
@jwt_required()
def get_followers_list(user_id):
    """Gets the list of patrons following the specified user (artist)."""
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": {"code": "AUTH_004", "message": "Cannot view followers list for another user."}}), 403

    user = User.query.get(current_user_id)
    if not user:
         return jsonify({"error": {"code": "USER_001", "message": "User not found."}}), 404

    if user.role != 'artist':
         return jsonify({"error": {"code": "AUTH_004", "message": "User is not an artist."}}), 403
    # --- End Authorization ---

    # --- Pagination ---
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = max(1, min(limit, 100))

    pagination = db.session.query(UserFollow, User)\
                           .join(User, UserFollow.patron_id == User.user_id)\
                           .filter(UserFollow.artist_id == current_user_id)\
                           .order_by(UserFollow.created_at.desc())\
                           .paginate(page=page, per_page=limit, error_out=False)

    follower_items = pagination.items
    total_items = pagination.total
    total_pages = pagination.pages
    # --- End Pagination ---

    # --- Serialization ---
    followers_data = []
    for follow_rel, patron in follower_items:
        patron_data = patron.to_dict(only=["user_id", "username", "profile_image_url"])
        patron_data["followed_at"] = follow_rel.created_at.isoformat() + 'Z' if follow_rel.created_at else None
        followers_data.append(patron_data)
    # --- End Serialization ---

    response = {
        "followers": followers_data,
        "pagination": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit
        }
    }
    return jsonify(response), 200