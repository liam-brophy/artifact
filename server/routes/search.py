from flask import Blueprint, request, jsonify
from server.models.artwork import Artwork  # Assuming Artwork is a model in your database
from server.models.user import User  # Assuming User is a model in your database

search_blueprint = Blueprint('search', __name__)

@search_blueprint.route('/', methods=['GET'])
def search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400

    # Example search logic: search artworks and users
    artworks = Artwork.query.filter(Artwork.title.ilike(f'%{query}%')).all()
    users = User.query.filter(User.username.ilike(f'%{query}%')).all()

    # Serialize results
    artwork_results = [{'id': artwork.artwork_id, 'title': artwork.title} for artwork in artworks]
    user_results = [{'id': user.user_id, 'username': user.username} for user in users]

    return jsonify({
        'artworks': artwork_results,
        'users': user_results
    })