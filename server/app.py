import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# Corrected import using absolute path
from server.config import get_config # Import ONLY get_config

# Initialize extensions globally first
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()

# Corrected function definition - removed default argument using get_config_name
def create_app():
    """Application Factory Pattern"""
    app = Flask(__name__)
    app_config = get_config() # Call the function to get the config object
    app.config.from_object(app_config) # Load config from the object

    # Initialize extensions with the app instance
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}}) # Adjust origins for production

    # --- Critical: Import models AFTER db is initialized and within app context ---
    with app.app_context():
        from server.models.user import User
        from server.models.artwork import Artwork
        from server.models.collection import Collection
        from server.models.user_follow import UserFollow

        from server.routes.auth import auth_bp
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        from server.routes.artworks import artworks_bp
        app.register_blueprint(artworks_bp, url_prefix='/api/artworks')
        from server.routes.users import users_bp
        app.register_blueprint(users_bp, url_prefix='/api/users')


    # Add a simple health check or root route if desired
    @app.route('/')
    def index():
        return jsonify({"status": "API is running!"})

    @app.route('/test-db')
    def test_db():
        try:
            db.session.execute('SELECT 1')
            return 'Database connection successful!'
        except Exception as e:
            return f'Database connection failed: {str(e)}'

    # Shell context for `flask shell`
    @app.shell_context_processor
    def make_shell_context():
        # Re-import models inside the function for the shell context
        from server.models.user import User
        # from server.models.artwork import Artwork # Add others
        return {'db': db, 'User': User} # Add 'Artwork': Artwork etc.

    return app

# Create the app instance for running/importing
app = create_app()


if __name__ == '__main__':
    # Debug mode should be controlled by config
    app.run(debug=app.config.get('DEBUG', False))