from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.services.auth_helper import artist_required
from server.models.user import User
from server.models.artwork import Artwork
from server.app import db
from sqlalchemy.exc import IntegrityError

artworks_bp = Blueprint('artworks', __name__)

# --- Helper Function for Artist Check ---
def check_artist_role(user_id):
    user = User.query.get(user_id)
    if not user or user.role != 'artist':
        return False, jsonify({"error": {"code": "AUTH_004", "message": "Action requires artist role."}}), 403
    return True, user, None # Return True, user object, None for error

# === POST /api/artworks ===
@artworks_bp.route('', methods=['POST'])
@artist_required
@jwt_required()
def create_artwork():
    """Creates a new artwork. Requires artist role."""
    current_user_id = get_jwt_identity()
    # The @artist_required decorator should handle the role check already
    # is_artist, user_or_error, status_code = check_artist_role(current_user_id)
    # if not is_artist:
    #     return user_or_error, status_code

    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No input data provided"}}), 400

    current_app.logger.info(f"Received artwork creation data: {data}") # Good to keep this log

    # --- Extract ALL required fields from Frontend ---
    title = data.get('title')
    artist_name = data.get('artist_name') # Extracted from request
    image_url = data.get('image_url')
    thumbnail_url = data.get('thumbnail_url') # Optional but expected key
    year_str = data.get('year') # Get potential null/empty string
    medium = data.get('medium')
    rarity = data.get('rarity')
    description = data.get('description') # Optional

    # --- Validation ---
    errors = {}
    # Basic presence checks (consider adding model-level validation later)
    if not title: errors['title'] = "Title is required."
    if not artist_name: errors['artist_name'] = "Artist name is required." # Add validation
    if not image_url: errors['image_url'] = "Image URL is required."
    if not medium: errors['medium'] = "Medium is required." # Add validation
    if not rarity: errors['rarity'] = "Rarity is required." # Add validation

    # Validate URLs if present
    if image_url:
        is_valid, msg = Artwork.validate_url(image_url, "Image URL")
        if not is_valid: errors['image_url'] = msg
    if thumbnail_url:
        is_valid, msg = Artwork.validate_url(thumbnail_url, "Thumbnail URL")
        if not is_valid: errors['thumbnail_url'] = msg

    # Validate description length if present
    if description and len(description) > 2000:
        errors['description'] = "Description exceeds maximum length of 2000 characters."

    # Validate year format (handle potential None or non-digit strings)
    year = None
    if year_str is not None and str(year_str).strip(): # Check if not None and not empty string
        try:
            year = int(year_str)
            if year < 0: # Example additional check
                 errors['year'] = "Year cannot be negative."
            # Add max year check if desired
        except (ValueError, TypeError):
            errors['year'] = "Year must be a valid whole number."
    # else: year remains None, which is allowed by DB if nullable=True, or needs handling if nullable=False

    # Add specific check for rarity against allowed ENUM values (optional but good practice)
    # allowed_rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] # Define or import
    # if rarity and rarity not in allowed_rarities:
    #     errors['rarity'] = f"Invalid rarity value. Must be one of: {', '.join(allowed_rarities)}"

    if errors:
        return jsonify({"error": {"code": "VALIDATION_001", "message": "Input validation failed", "details": errors}}), 400
    # --- End Validation ---

    # Create Artwork instance with ALL fields
    new_artwork = Artwork(
        artist_id=current_user_id,
        title=title.strip(),
        # artist_name=artist_name.strip(), # Pass the extracted artist_name
        description=description.strip() if description else None,
        image_url=image_url,
        thumbnail_url=thumbnail_url,
        year=year,                       # Pass the validated/converted year
        medium=medium.strip(),           # Pass the extracted medium
        rarity=rarity                    # Pass the extracted rarity
    )

    try:
        db.session.add(new_artwork)
        db.session.commit()
        current_app.logger.info(f"Artwork ID {new_artwork.artwork_id} created successfully.")
    except IntegrityError as e: # Catch specific IntegrityError
        db.session.rollback()
        current_app.logger.error(f"Database integrity error creating artwork: {e}", exc_info=True)
        # Provide more specific feedback if possible
        error_msg = f"Database error: {e.orig}" if hasattr(e, 'orig') else "Could not save artwork due to database integrity constraint."
        return jsonify({"error": {"code": "DB_INTEGRITY_ERROR", "message": error_msg}}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Generic database error creating artwork: {e}", exc_info=True)
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not save artwork due to database error"}}), 500

    # --- Serialization (Adjust if needed) ---
    # Fetch again is good practice if defaults/triggers modify the row
    created_artwork = Artwork.query.get(new_artwork.artwork_id)
    if not created_artwork:
         current_app.logger.error(f"Failed to fetch newly created artwork ID: {new_artwork.artwork_id}")
         return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to retrieve created artwork details"}}), 500

    try:
        # Use a schema or a method that includes the new fields if desired
        # artwork_schema = ArtworkSchema() # Example using Marshmallow
        # response_data = artwork_schema.dump(created_artwork)

        # Or update your to_dict or manual construction
        response_data = {
            "artwork_id": created_artwork.artwork_id,
            "artist_id": created_artwork.artist_id,
            "title": created_artwork.title,
            # "artist_name": created_artwork.artist_name, # Include artist_name
            "description": created_artwork.description,
            "image_url": created_artwork.image_url,
            "thumbnail_url": created_artwork.thumbnail_url,
            "year": created_artwork.year,           # Include year
            "medium": created_artwork.medium,       # Include medium
            "rarity": created_artwork.rarity,       # Include rarity
            "created_at": created_artwork.created_at.isoformat() if created_artwork.created_at else None, # Format datetime
            "updated_at": created_artwork.updated_at.isoformat() if created_artwork.updated_at else None, # Format datetime
        }

    except Exception as e:
        current_app.logger.exception("Serialization failed after creating artwork")
        return jsonify({"error": {"code": "SERIALIZATION_ERROR", "message": "Failed to serialize artwork data"}}), 500
    # --- End Serialization ---

    return jsonify(response_data), 201

# === ADD THIS ROUTE HANDLER ===
# === GET /api/artworks ===
@artworks_bp.route('', methods=['GET']) # Handles GET requests to the blueprint root
def get_artworks():
    """Gets a list of artworks, optionally paginated/limited."""
    try:
        # --- Parameters ---
        # Get pagination/limit parameters from request query string
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 12, type=int) # Default limit for homepage/general lists
        limit = min(limit, 50) # Apply a reasonable max limit

        # --- Query ---
        # Query artworks, eager load the related artist, order by newest first
        query = Artwork.query.options(
                    db.joinedload(Artwork.artist) # Eager load artist data
                ).order_by(Artwork.created_at.desc())

        # --- Pagination ---
        # Apply pagination to the query
        pagination = query.paginate(page=page, per_page=limit, error_out=False)
        artworks = pagination.items # Get the artworks for the current page

        # --- Serialization ---
        # Define the fields needed by the ArtworkCard component on the frontend
        # Use dot notation for nested artist fields
        artwork_card_fields = (
            "artwork_id",
            "title",
            "image_url",
            "thumbnail_url",
            "year",
            "medium",
            "artist_id",       # Include artist ID from the artwork table itself
            "artist.user_id",  # Include nested artist ID (can be redundant but explicit)
            "artist.username"  # Include nested artist username
            # Add any other necessary fields defined in your Artwork model
        )
        # Use the 'only' parameter with the defined fields
        serialized_artworks = [aw.to_dict(only=artwork_card_fields) for aw in artworks]

        # --- Prepare Response ---
        # Include both the artwork list and pagination info
        response = {
             "artworks": serialized_artworks,
             "pagination": {
                "total_items": pagination.total,
                "total_pages": pagination.pages,
                "current_page": page,
                "limit": limit
             }
        }
        return jsonify(response), 200

    except Exception as e:
        # Log the exception for debugging
        current_app.logger.exception("Error fetching artworks list")
        return jsonify({"error": {"message": "Failed to fetch artworks"}}), 500
# === END OF ADDED ROUTE HANDLER ===


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