from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from server.models.user import User # Need User model

def role_required(allowed_roles):
    """Decorator to check if user has one of the allowed roles."""
    def decorator(f):
        @wraps(f)
        @jwt_required() # Ensure user is logged in first
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)

            if not user:
                return jsonify({"error": {"code": "USER_001", "message": "User not found for token identity."}}), 404 # Or 401

            if user.role not in allowed_roles:
                return jsonify({"error": {"code": "AUTH_004", "message": f"Action requires one of roles: {', '.join(allowed_roles)}."}}), 403

            # Pass user object or just proceed if role is okay
            # You might modify this to pass the user object to the route function
            # kwargs['current_user'] = user # Example
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Specific decorators
def artist_required(f):
    return role_required(['artist'])(f)

def patron_required(f):
    return role_required(['patron'])(f)