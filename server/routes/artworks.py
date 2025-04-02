from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.services.auth_helper import artist_required
from server.models.user import User
from server.models.artwork import Artwork
from server.app import db

artworks_bp = Blueprint('artworks', __name__)

# --- Helper Function for Artist Check ---
def check_artist_role(user_id):
    user = User.query.get(user_id)
    if not user or user.role != 'artist':
        return False, jsonify({"error": {"code": "AUTH_004", "message": "Action requires artist role."}}), 403
    return True, user, None # Return True, user object, None for error

# === POST /api/artworks ===
@artworks_bp.route('', methods=['POST'])
@artist_required # Use the decorator if you want to enforce artist role at the route level
@jwt_required() # Protect the route
def create_artwork():
    """Creates a new artwork. Requires artist role."""
    current_user_id = get_jwt_identity()
    is_artist, user_or_error, status_code = check_artist_role(current_user_id)
    if not is_artist:
        return user_or_error, status_code

    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No input data provided"}}), 400

    # --- Validation ---
    title = data.get('title')
    image_url = data.get('image_url')
    description = data.get('description') # Optional
    thumbnail_url = data.get('thumbnail_url') # Optional
    edition_size_str = data.get('edition_size', '1') # Default to 1 if not provided
    is_available = data.get('is_available', True) # Default to True

    errors = {}
    is_valid, msg = Artwork.validate_title(title)
    if not is_valid: errors['title'] = msg

    is_valid, msg = Artwork.validate_url(image_url, "Image URL")
    if not is_valid: errors['image_url'] = msg

    if thumbnail_url: # Validate thumbnail only if provided
        is_valid, msg = Artwork.validate_url(thumbnail_url, "Thumbnail URL")
        if not is_valid: errors['thumbnail_url'] = msg

    try:
        edition_size = int(edition_size_str)
        is_valid, msg = Artwork.validate_edition_size(edition_size)
        if not is_valid: errors['edition_size'] = msg
    except (ValueError, TypeError):
        errors['edition_size'] = "Edition size must be a valid integer."

    if description and len(description) > 2000:
        errors['description'] = "Description exceeds maximum length of 2000 characters."

    if not isinstance(is_available, bool):
         errors['is_available'] = "is_available must be true or false."


    if errors:
        return jsonify({"error": {"code": "VALIDATION_001", "message": "Input validation failed", "details": errors}}), 400
    # --- End Validation ---

    # Create Artwork instance
    # For simplicity now, assuming edition_number defaults to 1 on creation.
    # You might need more complex logic if handling multiple editions of the same conceptual piece.
    new_artwork = Artwork(
        artist_id=current_user_id,
        title=title,
        description=description,
        image_url=image_url,
        thumbnail_url=thumbnail_url,
        edition_size=edition_size,
        is_available=is_available,
        edition_number=1 # Default assumption
    )

    try:
        db.session.add(new_artwork)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Database error creating artwork - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not save artwork due to database error"}}), 500

    # Fetch again to include relationships/defaults if needed by to_dict
    created_artwork = Artwork.query.get(new_artwork.artwork_id)
    if not created_artwork:
         print(f"ERROR: Failed to fetch newly created artwork ID: {new_artwork.artwork_id}")
         return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to retrieve created artwork details"}}), 500


    # --- Serialization ---
    # Use the model's to_dict method, ensuring artist info isn't included redundantly
    # or tailor the response exactly as per spec
    artwork_data = created_artwork.to_dict(include_artist=False) # Don't nest artist info here

    # Match the spec response format for POST /api/artworks
    response_data = {
        "artwork_id": artwork_data['artwork_id'],
        "artist_id": current_user_id, # Add artist_id explicitly
        "title": artwork_data['title'],
        "description": artwork_data['description'],
        "image_url": artwork_data['image_url'],
        "thumbnail_url": artwork_data['thumbnail_url'],
        "created_at": artwork_data['created_at'],
        "is_available": artwork_data['is_available'],
        "edition_size": artwork_data['edition_size'],
        "edition_number": artwork_data['edition_number'] # Assuming it's 1 from creation
    }
    # --- End Serialization ---

    return jsonify(response_data), 201


# === GET /api/artworks/:artwork_id ===
@artworks_bp.route('/<int:artwork_id>', methods=['GET'])
@jwt_required() # Require login to view artwork details (per spec)
def get_artwork_details(artwork_id):
    """Gets details for a specific artwork."""
    # current_user_id = get_jwt_identity() # Needed later for ownership checks

    artwork = Artwork.query.get_or_404(artwork_id) # Use get_or_404 for convenience

    # --- Authorization Check (Basic for now - refine later) ---
    # Spec implies patrons might only see artworks they own if not available.
    # For now, let's allow any logged-in user to see any artwork.
    # Add complex visibility logic later based on `is_available` and ownership.
    # Example placeholder:
    # if not artwork.is_available:
    #     # Check if current_user_id owns this artwork via Collections table
    #     is_owner = Collection.query.filter_by(patron_id=current_user_id, artwork_id=artwork_id).first()
    #     if not is_owner and artwork.artist_id != current_user_id:
    #          return jsonify({"error": {"code": "ARTWORK_002", "message": "You do not have permission to view this artwork."}}), 403
    # --- End Authorization Placeholder ---


    # --- Serialization ---
    # Use to_dict, ensuring artist info is included as per spec
    response_data = artwork.to_dict(include_artist=True)
    # --- End Serialization ---

    return jsonify(response_data), 200