# This file makes the 'routes' directory a Python package.

from .search import search_blueprint  # Import the search blueprint

# Export the blueprints to be registered in app.py
__all__ = ['search_blueprint']