from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
    get_jwt_identity, get_jwt)
from sqlalchemy.exc import IntegrityError
import requests # Needed for Google auth transport
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests 
# Import necessary items from the models package and the main app file
from server.models.user import User
from server.app import db # Import the db instance initialized in app.py

# Create the blueprint
auth_bp = Blueprint('auth', __name__)



# --- Helper Functions ---

def _generate_unique_username(base_username):
    """Generates a unique username based on a base, appending numbers if needed."""
    username = base_username
    counter = 1
    # Limit iterations to prevent infinite loops in unexpected scenarios
    max_attempts = 100
    while User.query.filter_by(username=username).first():
        if counter >= max_attempts:
            # Log error and raise an exception or return None to indicate failure
            current_app.logger.error(f"Could not generate unique username for base '{base_username}' after {max_attempts} attempts.")
            return None # Indicate failure
        username = f"{base_username}{counter}"
        counter += 1
    return username

def _create_google_user(idinfo, role):
    """Creates a new User record from Google idinfo and a validated role."""
    user_email = idinfo['email']
    base_username = user_email.split('@')[0]
    username = _generate_unique_username(base_username)

    if not username:
        # Username generation failed
        return None, {"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Could not create unique username."}}, 500

    new_user = User(
        username=username,
        email=user_email,
        password_hash='!OAUTH_GOOGLE!', # Placeholder - cannot log in with password
        role=role, # Use the validated role passed in
        profile_image_url=idinfo.get('picture'),
        # Consider making bio optional or setting a default in the model
        bio=f"Signed up via Google. Name: {idinfo.get('name', 'N/A')}"
    )
    try:
        db.session.add(new_user)
        db.session.flush() # Assigns an ID to new_user without committing yet
        # Commit handled after user object is needed
        return new_user, None, None # Return user, no error, no status code
    except IntegrityError as e: # Catch potential race condition on unique constraints (email/username)
        db.session.rollback()
        current_app.logger.error(f"Integrity error creating Google user {user_email}: {e}")
        # Check if the user was created in between the initial check and now
        existing_user = User.query.filter_by(email=user_email).first()
        if existing_user:
            # This means it was a race condition, treat as existing user scenario (let caller handle)
            return existing_user, None, None
        else:
             # Different integrity error (e.g., role constraint?)
             return None, {"error": {"code": "DB_CONFLICT", "message": "Could not create user account due to database conflict."}}, 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Database error creating Google user {user_email}: {e}")
        return None, {"error": {"code": "DB_ERROR", "message": "Could not create user account due to database error."}}, 500

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register_user():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json()

    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No input data provided"}}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')

    # --- Validation ---
    errors = {}
    is_valid, msg = User.validate_username(username)
    if not is_valid: errors['username'] = msg

    is_valid, msg = User.validate_email(email)
    if not is_valid: errors['email'] = msg

    is_valid, msg = User.validate_password(password)
    if not is_valid: errors['password'] = msg

    is_valid, msg = User.validate_role(role)
    if not is_valid: errors['role'] = msg

    if errors:
        return jsonify({"error": {"code": "VALIDATION_001", "message": "Input validation failed", "details": errors}}), 400
    # --- End Validation ---

    # Check uniqueness
    if User.query.filter_by(username=username).first():
        return jsonify({"error": {"code": "USER_002", "message": "Username is already taken"}}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": {"code": "USER_003", "message": "Email address is already registered"}}), 409

    # Create and save user
    new_user = User(username=username, email=email, role=role)
    new_user.set_password(password) # Hash password

    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # Use proper logging in a real application
        print(f"ERROR: Database error during registration - {e}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not register user due to database error"}}), 500

    # Fetch the created user to get the generated ID and defaults
    created_user = User.query.get(new_user.user_id)
    if not created_user:
         # Should not happen if commit was successful, but handle defensively
         print(f"ERROR: Failed to fetch newly created user ID: {new_user.user_id}")
         return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to retrieve registered user details"}}), 500

    # --- Serialization ---
    # Use .to_dict() with "only" to return the required fields
    user_data = created_user.to_dict(only=["user_id", "username", "email", "role", "created_at"])
    # --- End Serialization ---

    return jsonify(user_data), 201


@auth_bp.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()

    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No input data provided"}}), 400

    email = data.get('email')
    password = data.get('password')

    # Basic check for required fields
    if not email or not password:
         errors = {}
         if not email: errors['email'] = "Email is required."
         if not password: errors['password'] = "Password is required."
         return jsonify({"error": {"code": "VALIDATION_001", "message": "Input validation failed", "details": errors}}), 400

    # Find user
    user = User.query.filter_by(email=email).first()

    # Verify user and password
    if user and user.check_password(password):
        # Create JWTs
        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id) # Handle refresh later

        # Update last login time
        try:
            user.last_login = db.func.current_timestamp()
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"WARN: Database error updating last_login for user {user.user_id} - {e}")
            # Non-critical error, proceed with login

        # --- Serialization ---
        # Use .to_dict() with "only" to include only the required fields for login response
        login_user_response = user.to_dict(only=["user_id", "username", "role"])
        # --- End Serialization ---

        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": login_user_response
        }), 200
    else:
        # Invalid credentials
        return jsonify({"error": {"code": "AUTH_002", "message": "Invalid email or password"}}), 401


# === POST /api/auth/refresh ===
@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True) # Requires a valid REFRESH token, not an access token
def refresh_access_token():
    """Provides a new access token using a refresh token."""
    current_user_id = get_jwt_identity() # Get user ID from the refresh token
    # Optional: Could add checks here to ensure the user still exists/is active
    # user = User.query.get(current_user_id)
    # if not user or not user.is_active:
    #     return jsonify({"error": {"code": "AUTH_007", "message": "User inactive or not found."}}), 401

    # Create a new access token
    new_access_token = create_access_token(identity=current_user_id)

    return jsonify(access_token=new_access_token), 200

# === GET /api/auth/me ===
@auth_bp.route('/me', methods=['GET'])
@jwt_required() # Requires a valid ACCESS token
def get_current_user_profile():
    """Gets the profile information for the currently authenticated user."""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user:
        # This shouldn't happen if JWT is valid unless user deleted mid-session
        return jsonify({"error": {"code": "USER_001", "message": "User not found for token identity."}}), 404 # Return 404 if user gone

    # --- Serialization ---
    # Return necessary user details (avoid sending password hash etc.)
    # Adjust the fields in 'only' based on what your frontend needs in the context
    user_data = user.to_dict(only=["user_id", "username", "email", "role", "created_at", "last_login"])
    # --- End Serialization ---

    return jsonify(user_data), 200

    # === POST /api/auth/logout ===
@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True) # Require refresh token for logout to invalidate long-term session
def logout_user():
    """Logs out the user by blocklisting the refresh token."""
    jwt_data = get_jwt() # Get the full decoded JWT payload
    jti = jwt_data['jti'] # Unique identifier for the JWT
    token_type = jwt_data['type'] # Should be 'refresh'
    current_user_id = get_jwt_identity()

    

    return jsonify({"message": "Logout successful. Refresh token invalidated."}), 200



@auth_bp.route('/google', methods=['POST', 'OPTIONS'])
def google_auth():
    """
    Authenticates a user via a Google ID token.
    If the user exists, logs them in.
    If the user does not exist (Google Sign-Up), requires a 'role' in the
    request body and creates a new user with that role.
    Returns JWT tokens and basic user info upon success.
    """
    # Handle CORS preflight request (Flask-CORS should ideally handle this)
    if request.method == 'OPTIONS':
        # If Flask-CORS is properly configured, this might not even be hit,
        # but it's safe to include a default handler.
        return current_app.make_default_options_response()

    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No JSON data provided."}}), 400

    google_id_token = data.get('token')
    requested_role = data.get('role') # Role sent by frontend during SIGN UP

    if not google_id_token:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'token' (Google ID Token) in request body."}}), 400

    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not google_client_id:
         # Use logger instead of print
         current_app.logger.error("CONFIG_ERROR: GOOGLE_CLIENT_ID not configured in backend.")
         return jsonify({"error": {"code": "CONFIG_ERROR", "message": "Google authentication is not configured correctly on the server."}}), 500

    try:
        # Verify the ID token using Google's library
        idinfo = id_token.verify_oauth2_token(
            google_id_token,
            google_requests.Request(), # Transport object
            google_client_id
        )

        # Check if email is verified by Google
        if not idinfo.get('email_verified'):
            current_app.logger.warning(f"Google Auth attempt failed: Email '{idinfo.get('email')}' not verified by Google.")
            return jsonify({"error": {"code": "AUTH_GOOGLE_EMAIL_UNVERIFIED", "message": "Google email must be verified."}}), 401 # 401 or 403 could fit

        user_email = idinfo['email']
        user = User.query.filter_by(email=user_email).first()
        is_new_user = False

        if not user:
            # --- New User Sign-Up Flow ---
            is_new_user = True
            current_app.logger.info(f"New user attempting Google Sign-Up: {user_email}")

            # Role is MANDATORY for new sign-ups via Google
            if not requested_role:
                return jsonify({"error": {"code": "VALIDATION_ROLE_MISSING", "message": "Role ('artist' or 'patron') is required for Google Sign-Up."}}), 400

            # Validate the role
            is_valid_role, role_msg_or_val = User.validate_role(requested_role)
            if not is_valid_role:
                 return jsonify({"error": {"code": "VALIDATION_ROLE_INVALID", "message": f"Invalid role provided: {role_msg_or_val}"}}), 400
            validated_role = role_msg_or_val # Use the validated role value

            if not validated_role: # Should be redundant if validate_role is correct, but safe
                current_app.logger.error(f"Role validation unexpectedly resulted in an empty role. Input was: '{requested_role}'. Validation output: '{role_msg_or_val}'")
                return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Role processing failed after validation."}}), 500

            user, error_payload, error_code = _create_google_user(idinfo, validated_role)

            # Attempt to create the user
            user, error_payload, error_code = _create_google_user(idinfo, validated_role)
            if error_payload:
                # _create_google_user encountered an error
                return jsonify(error_payload), error_code
            # If user is returned but was actually found due to race condition, proceed as existing user
            if not user:
                 # Should not happen if _create_google_user didn't return an error, but defensive check
                 current_app.logger.error(f"User object unexpectedly None after _create_google_user for {user_email}")
                 return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to process user creation."}}), 500

            

        # --- User Exists or Was Just Created ---
        if is_new_user:
            current_app.logger.info(f"Successfully created new user via Google: ID {user.user_id}, Email {user.email}, Role {user.role}")
        else:
             current_app.logger.info(f"Existing user logged in via Google: ID {user.user_id}, Email {user.email}")


        # --- Issue Application JWTs ---
        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id)

        # Update last_login for both existing and new users (commit separately)
        try:
            user.last_login = db.func.current_timestamp()
            # Commit the user creation (if new) AND the last_login update
            db.session.commit()
        except Exception as e:
            db.session.rollback() # Rollback only this commit attempt
            current_app.logger.warning(f"DB warning: Failed to update last_login for user {user.user_id} during Google auth: {e}")
            # Proceed with login/signup even if last_login fails

        # --- Serialization ---
        login_user_response = user.to_dict(
            only=('user_id', 'username', 'email', 'role', 'profile_image_url') # Include relevant fields
        )

        return jsonify({
            "message": "Google authentication successful." + (" Welcome!" if is_new_user else ""),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": login_user_response
        }), 200 # Return 200 for both login and successful signup via Google

    except ValueError as e:
        # Invalid token (expired, bad signature, wrong audience, etc.)
        current_app.logger.warning(f"Invalid Google ID token received: {e}")
        return jsonify({"error": {"code": "AUTH_GOOGLE_TOKEN_INVALID", "message": "Invalid or expired Google token."}}), 401
    except Exception as e:
        # Catch-all for other unexpected errors during verification or processing
        db.session.rollback() # Rollback any potential transaction
        current_app.logger.exception("Unexpected error during Google authentication.") # Logs exception info
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred during Google authentication."}}), 500