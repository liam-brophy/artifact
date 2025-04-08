from flask import Blueprint, request, jsonify, current_app, make_response
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
    get_jwt_identity, get_jwt, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies, current_user as jwt_current_user, # Use current_user for user loading
    get_jti # To get JTI for blocklisting
)
from sqlalchemy.exc import IntegrityError
import requests # Needed for Google auth transport
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
# Import necessary items from the models package and the main app file
from ..models.user import User
from ..extensions import db, jwt, BLOCKLIST # Import db AND the example BLOCKLIST

# Create the blueprint
auth_bp = Blueprint('auth', __name__)

# --- User Loader Callback (Required by Flask-JWT-Extended) ---
# This callback is used whenever @jwt_required() is used or current_user is accessed.
# It should take the identity of the JWT and return the corresponding user object.
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"] # "sub" is the standard claim for subject (user identity)
    return User.query.get(identity)

# --- Helper Functions (Keep _generate_unique_username and _create_google_user as they are) ---
def _generate_unique_username(base_username):
    """Generates a unique username based on a base, appending numbers if needed."""
    username = base_username
    counter = 1
    max_attempts = 100
    while User.query.filter_by(username=username).first():
        if counter >= max_attempts:
            current_app.logger.error(f"Could not generate unique username for base '{base_username}' after {max_attempts} attempts.")
            return None
        username = f"{base_username}{counter}"
        counter += 1
    return username

def _create_google_user(idinfo, role):
    """Creates a new User record from Google idinfo and a validated role."""
    user_email = idinfo['email']
    base_username = user_email.split('@')[0]
    username = _generate_unique_username(base_username)

    if not username:
        return None, {"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Could not create unique username."}}, 500

    new_user = User(
        username=username,
        email=user_email,
        password_hash='!OAUTH_GOOGLE!',
        role=role,
        profile_image_url=idinfo.get('picture'),
        bio=f"Signed up via Google. Name: {idinfo.get('name', 'N/A')}"
    )
    try:
        db.session.add(new_user)
        db.session.flush()
        return new_user, None, None
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Integrity error creating Google user {user_email}: {e}")
        existing_user = User.query.filter_by(email=user_email).first()
        if existing_user:
            return existing_user, None, None
        else:
             return None, {"error": {"code": "DB_CONFLICT", "message": "Could not create user account due to database conflict."}}, 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Database error creating Google user {user_email}: {e}")
        return None, {"error": {"code": "DB_ERROR", "message": "Could not create user account due to database error."}}, 500


# --- Routes ---

# Keep /register as is - it doesn't involve tokens directly
@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register_user():
    if request.method == 'OPTIONS':
        return '', 204 # Basic CORS preflight response

    data = request.get_json()
    # ... (keep validation and user creation logic as before) ...
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

    # Check uniqueness
    if User.query.filter_by(username=username).first():
        return jsonify({"error": {"code": "USER_002", "message": "Username is already taken"}}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": {"code": "USER_003", "message": "Email address is already registered"}}), 409

    # Create and save user
    new_user = User(username=username, email=email, role=role)
    new_user.set_password(password)

    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception(f"Database error during registration for email {email}")
        return jsonify({"error": {"code": "DB_ERROR", "message": "Could not register user due to database error"}}), 500

    created_user = User.query.get(new_user.user_id)
    if not created_user:
         current_app.logger.error(f"Failed to fetch newly created user ID: {new_user.user_id}")
         return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to retrieve registered user details"}}), 500

    user_data = created_user.to_dict(only=["user_id", "username", "email", "role", "created_at"])
    return jsonify(user_data), 201


@auth_bp.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No input data provided"}}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        errors = {}
        if not email: errors['email'] = "Email is required."
        if not password: errors['password'] = "Password is required."
        return jsonify({"error": {"code": "VALIDATION_001", "message": "Input validation failed", "details": errors}}), 400

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id)
        try:
            user.last_login = db.func.current_timestamp()  # Using imported db
            db.session.commit()                            # Using imported db
        except Exception as e:
            db.session.rollback()                          # Using imported db
            current_app.logger.warning(f"DB warning: Failed to update last_login for user {user.user_id} during login: {e}")

        login_user_response_data = user.to_dict(only=["user_id", "username", "role", "email", "profile_image_url"])
        response = jsonify({
            "message": "Login successful",
            "user": login_user_response_data
        })
        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)
        return response, 200
    else:
        return jsonify({"error": {"code": "AUTH_002", "message": "Invalid email or password"}}), 401


@auth_bp.route('/status', methods=['GET'])
@jwt_required(optional=True)  # Decorator uses 'jwt' imported from extensions
def auth_status():
    current_identity = get_jwt_identity()
    if current_identity:
        user = User.query.get(current_identity)  # Using User model
        if user:
            user_data = user.to_dict(only=["user_id", "username", "role", "email", "profile_image_url"])
            return jsonify(user=user_data), 200
        else:
            response = jsonify(user=None)
            unset_jwt_cookies(response)
            return response, 200
    else:
        return jsonify(user=None), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)  # Decorator uses 'jwt' imported from extensions
def refresh_access_token():
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user_id)
    response = jsonify(message="Access token refreshed successfully")
    set_access_cookies(response, new_access_token)
    return response, 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()  # Decorator uses 'jwt' imported from extensions
def get_current_user_profile():
    # jwt_current_user uses the loader defined in app.py
    user = jwt_current_user
    user_data = user.to_dict(only=["user_id", "username", "email", "role", "created_at", "last_login", "profile_image_url"])
    return jsonify(user_data), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True)  # Decorator uses 'jwt' imported from extensions
def logout_user():
    jwt_payload = get_jwt()
    jti = jwt_payload['jti']
    # Use BLOCKLIST imported from extensions
    BLOCKLIST.add(jti)
    response = jsonify({"message": "Logout successful. Session invalidated."})
    unset_jwt_cookies(response)
    return response, 200


@auth_bp.route('/google', methods=['POST', 'OPTIONS'])
def google_auth():
    if request.method == 'OPTIONS':
        return current_app.make_default_options_response()

    data = request.get_json()
    if not data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No JSON data provided."}}), 400

    google_id_token = data.get('token')
    requested_role = data.get('role')  # Still needed for sign-up flow

    if not google_id_token:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'token' (Google ID Token) in request body."}}), 400

    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not google_client_id:
        current_app.logger.error("CONFIG_ERROR: GOOGLE_CLIENT_ID not configured in backend.")
        return jsonify({"error": {"code": "CONFIG_ERROR", "message": "Google authentication is not configured correctly on the server."}}), 500

    try:
        idinfo = id_token.verify_oauth2_token(
            google_id_token, google_requests.Request(), google_client_id
        )

        if not idinfo.get('email_verified'):
            current_app.logger.warning(f"Google Auth attempt failed: Email '{idinfo.get('email')}' not verified by Google.")
            return jsonify({"error": {"code": "AUTH_GOOGLE_EMAIL_UNVERIFIED", "message": "Google email must be verified."}}), 401

        user_email = idinfo['email']
        user = User.query.filter_by(email=user_email).first()
        is_new_user = False

        if not user:
            is_new_user = True
            current_app.logger.info(f"New user attempting Google Sign-Up: {user_email}")

            if not requested_role:
                return jsonify({"error": {"code": "VALIDATION_ROLE_MISSING", "message": "Role ('artist' or 'patron') is required for Google Sign-Up."}}), 400

            is_valid_role, role_msg_or_val = User.validate_role(requested_role)
            if not is_valid_role:
                return jsonify({"error": {"code": "VALIDATION_ROLE_INVALID", "message": f"Invalid role provided: {role_msg_or_val}"}}), 400
            validated_role = role_msg_or_val

            if not validated_role:
                current_app.logger.error(f"Role validation unexpectedly resulted in an empty role for {user_email}.")
                return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Role processing failed."}}), 500

            user, error_payload, error_code = _create_google_user(idinfo, validated_role)
            if error_payload:
                return jsonify(error_payload), error_code
            if not user:
                current_app.logger.error(f"User object unexpectedly None after _create_google_user for {user_email}")
                return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "Failed to process user creation."}}), 500

        if is_new_user:
            current_app.logger.info(f"Successfully created new user via Google: ID {user.user_id}, Email {user.email}, Role {user.role}")
        else:
            current_app.logger.info(f"Existing user logged in via Google: ID {user.user_id}, Email {user.email}")

        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id)
        login_user_response_data = user.to_dict(
            only=('user_id', 'username', 'email', 'role', 'profile_image_url')
        )
        response = jsonify({
            "message": "Google authentication successful." + (" Welcome!" if is_new_user else ""),
            "user": login_user_response_data
        })
        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)
        try:
            user.last_login = db.func.current_timestamp()  # Using imported db
            db.session.commit()                            # Using imported db
        except Exception as e:
            db.session.rollback()                          # Using imported db
            current_app.logger.warning(f"DB warning: Failed to commit user or update last_login for user {user.user_id} during Google auth: {e}")
        return response, 200

    except ValueError as e:
        current_app.logger.warning(f"Invalid Google ID token received: {e}")
        return jsonify({"error": {"code": "AUTH_GOOGLE_TOKEN_INVALID", "message": "Invalid or expired Google token."}}), 401
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Unexpected error during Google authentication.")
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred during Google authentication."}}), 500