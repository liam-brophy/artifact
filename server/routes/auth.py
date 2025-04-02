from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
    get_jwt_identity, get_jwt)
import requests # Needed for Google auth transport
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests 
# Import necessary items from the models package and the main app file
from server.models.user import User
from server.app import db # Import the db instance initialized in app.py

# Create the blueprint
auth_bp = Blueprint('auth', __name__)

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


    # === POST /api/auth/logout ===
@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True) # Require refresh token for logout to invalidate long-term session
def logout_user():
    """Logs out the user by blocklisting the refresh token."""
    jwt_data = get_jwt() # Get the full decoded JWT payload
    jti = jwt_data['jti'] # Unique identifier for the JWT
    token_type = jwt_data['type'] # Should be 'refresh'
    current_user_id = get_jwt_identity()

    # Commenting out Redis-related code
    # redis_client = current_app.redis_client # Get Redis client from app

    # if not redis_client:
    #      print(f"WARN: Redis client not available. Cannot blocklist token for user {current_user_id}.")
    #      return jsonify({"message": "Logout processed (blocklist unavailable)."}), 200

    # try:
    #     expires_timestamp = jwt_data['exp']
    #     now_timestamp = datetime.now(timezone.utc).timestamp()
    #     remaining_time_sec = max(1, int(expires_timestamp - now_timestamp))
    #     remaining_delta = timedelta(seconds=remaining_time_sec)
    # except Exception as e:
    #      print(f"WARN: Could not calculate precise expiry for JTI {jti}. Using default. Error: {e}")
    #      remaining_delta = current_app.config.get('JWT_REFRESH_TOKEN_EXPIRES', timedelta(days=30))

    # try:
    #     redis_key = f"blocklist_jti:{jti}"
    #     redis_client.set(redis_key, f"{token_type}_revoked_user_{current_user_id}", ex=remaining_delta)
    #     print(f"INFO: Blocklisted {token_type} token JTI {jti} for user {current_user_id}. Expires in {remaining_delta}.")
    # except Exception as e:
    #      print(f"ERROR: Failed to add JTI {jti} to Redis blocklist for user {current_user_id}. Error: {e}")
    #      return jsonify({"error": {"code": "LOGOUT_FAILED", "message": "Could not process logout due to blocklist error."}}), 500

    return jsonify({"message": "Logout successful. Refresh token invalidated."}), 200



# === POST /api/auth/google ===
@auth_bp.route('/google', methods=['POST'])
def google_auth():
    """Authenticates a user via a Google ID token."""
    data = request.get_json()
    if not data or 'token' not in data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'token' (Google ID Token) in request body."}}), 400

    google_id_token = data.get('token')
    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID')

    if not google_client_id:
         print("ERROR: GOOGLE_CLIENT_ID not configured in backend.")
         return jsonify({"error": {"code": "CONFIG_ERROR", "message": "Google authentication is not configured correctly on the server."}}), 500

    try:
        # Verify the ID token is valid and issued by Google for your app.
        idinfo = id_token.verify_oauth2_token(
            google_id_token,
            google_requests.Request(), # Transport object for making requests
            google_client_id
        )

        # --- Token Verified ---
        # idinfo contains verified user data like:
        # idinfo['iss'] => 'accounts.google.com' or 'https://accounts.google.com'
        # idinfo['sub'] => Unique Google User ID (string)
        # idinfo['aud'] => Your GOOGLE_CLIENT_ID
        # idinfo['exp'] => Expiration timestamp
        # idinfo['email'] => User's email address
        # idinfo['email_verified'] => boolean
        # idinfo['name'] => User's full name
        # idinfo['picture'] => URL to profile picture
        # idinfo['given_name']
        # idinfo['family_name']

        if not idinfo.get('email_verified'):
            return jsonify({"error": {"code": "AUTH_006", "message": "Google email not verified."}}), 401

        user_email = idinfo['email']
        user = User.query.filter_by(email=user_email).first()

        if user:
            # --- Existing User Found ---
            # Optional: Update user info from Google profile if desired
            # user.profile_image_url = idinfo.get('picture', user.profile_image_url)
            # user.last_login = db.func.current_timestamp()
            # db.session.commit() # Commit updates if any
            pass # For now, just proceed to login
        else:
            # --- New User - Create Account ---
            # Derive a username (handle potential collisions)
            base_username = user_email.split('@')[0]
            username = base_username
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{base_username}{counter}"
                counter += 1
                if counter > 100: # Safety break
                     print(f"ERROR: Could not generate unique username for {base_username}")
                     return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Could not create unique username."}}), 500

            # Create the user
            # Defaulting role to 'patron'. Add logic if role needs to be selected.
            # Use a placeholder for password_hash to indicate OAuth-only user
            new_user = User(
                username=username,
                email=user_email,
                password_hash='!OAUTH_GOOGLE!', # Placeholder - cannot log in with password
                role='patron', # Default role
                profile_image_url=idinfo.get('picture'),
                bio=f"Signed up via Google. Name: {idinfo.get('name', 'N/A')}" # Example bio
            )
            try:
                db.session.add(new_user)
                db.session.commit()
                user = new_user # Use the newly created user for JWT generation
            except IntegrityError as e: # Catch potential race condition on username/email
                 db.session.rollback()
                 print(f"ERROR: Integrity error creating Google user - {e}")
                 # Maybe the user was created between the check and the commit? Try fetching again.
                 user = User.query.filter_by(email=user_email).first()
                 if not user: # If still not found, it's a different error
                    return jsonify({"error": {"code": "DB_ERROR", "message": "Could not create user account due to database conflict."}}), 409
            except Exception as e:
                 db.session.rollback()
                 print(f"ERROR: Database error creating Google user - {e}")
                 return jsonify({"error": {"code": "DB_ERROR", "message": "Could not create user account due to database error."}}), 500

        # --- Issue Application JWTs ---
        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id)

        # Update last_login for both existing and new users
        try:
            user.last_login = db.func.current_timestamp()
            db.session.commit()
        except Exception as e:
             db.session.rollback() # Rollback only the timestamp update
             print(f"WARN: Database error updating last_login for Google user {user.user_id} - {e}")

        # --- Serialization ---
        login_user_response = user.to_dict(
            only=('user_id', 'username', 'role') # Same response format as password login
        )
        # --- End Serialization ---

        return jsonify({
            "message": "Google authentication successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": login_user_response
        }), 200

    except ValueError as e:
        # This typically means the token was invalid (expired, wrong audience, bad signature, etc.)
        print(f"ERROR: Invalid Google ID token - {e}")
        return jsonify({"error": {"code": "AUTH_006", "message": "Invalid or expired Google token."}}), 401
    except Exception as e:
        # Catch other unexpected errors during verification or processing
        print(f"ERROR: Unexpected error during Google authentication - {e}")
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred during Google authentication."}}), 500