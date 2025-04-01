from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token

# Import necessary items from the models package and the main app file
from server.models.user import User
from server.app import db # Import the db instance initialized in app.py

# Create the blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register_user():
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

# Optional: Refresh token endpoint
# @auth_bp.route('/refresh', methods=['POST'])
# @jwt_required(refresh=True)
# ...