from functools import wraps
from flask import jsonify, current_app # <-- Import current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from server.models.user import User

def role_required(allowed_roles):
    """Decorator to check if user has one of the allowed roles."""
    def decorator(f):
        @wraps(f)
        # @jwt_required() # Keep this logically, but let's verify manually inside for logging
        def decorated_function(*args, **kwargs):
            # <<< DETAILED LOGGING ADDED >>>
            current_app.logger.info(f"--- ENTERING role_required (for roles: {allowed_roles}) ---")
            try:
                # Manually verify JWT to allow logging around it
                verify_jwt_in_request()
                current_app.logger.info("JWT verification successful (verify_jwt_in_request)")

                current_user_id = get_jwt_identity()
                current_app.logger.info(f"JWT Identity retrieved: {current_user_id}")

                user = User.query.get(current_user_id)
                current_app.logger.info(f"User object fetched from DB: {'Found' if user else 'NOT Found'}")

                if not user:
                    current_app.logger.warning(f"User not found for identity {current_user_id}, returning 404")
                    return jsonify({"error": {"code": "USER_001", "message": "User not found for token identity."}}), 404

                current_app.logger.info(f"Checking user role: '{user.role}' against allowed: {allowed_roles}")
                if user.role not in allowed_roles:
                    current_app.logger.warning(f"User role '{user.role}' NOT in allowed roles {allowed_roles}, returning 403")
                    return jsonify({"error": {"code": "AUTH_004", "message": f"Action requires one of roles: {', '.join(allowed_roles)}."}}), 403

                current_app.logger.info(f"Role check PASSED for user {current_user_id}. Proceeding to wrapped function...")
                # Pass user object or just proceed if role is okay
                return f(*args, **kwargs)

            except Exception as e:
                # Log specific JWT errors differently? Flask-JWT-Extended might raise specific exceptions.
                current_app.logger.error(f"!!! EXCEPTION inside role_required decorator: {type(e).__name__} - {e}", exc_info=True)
                # Return a generic 500 or re-raise depending on desired behaviour
                # Checking if it's a JWT error might give clues
                if "jwt" in type(e).__name__.lower():
                     return jsonify({"error": {"code": "JWT_ERROR", "message": f"JWT processing error: {e}"}}), 401 # Or appropriate code
                return jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Error during role check execution."}}), 500
            finally:
                 current_app.logger.info(f"--- EXITING role_required (for roles: {allowed_roles}) ---")
           # <<< END LOGGING BLOCK >>>
        return decorated_function
    return decorator

# Specific decorators (no changes needed here)
def artist_required(f):
    # We modify role_required, so this automatically uses the logged version
    return role_required(['artist'])(f)

def patron_required(f):
    return role_required(['patron'])(f)