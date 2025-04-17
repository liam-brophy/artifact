from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from server.models.trade import Trade
from server.models.collection import Collection
from server.models.user_follow import UserFollow
from server.extensions import db  # Import from extensions instead of app
from sqlalchemy import and_, or_

# Create the blueprint for trade routes
trades_bp = Blueprint('trades', __name__)

@trades_bp.route('/trades', methods=['POST'])
@jwt_required()
def create_trade():
    """Create a new trade offer between users"""
    try:
        data = request.get_json()
        
        # Debug log
        current_app.logger.info(f"Trade request data: {data}")
        
        # Validate required fields
        required_fields = ['recipient_id', 'offered_artwork_id', 'requested_artwork_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Extract data from request
        recipient_id = data['recipient_id']
        offered_artwork_id = data['offered_artwork_id']
        requested_artwork_id = data['requested_artwork_id']
        message = data.get('message', '')  # Optional message
        
        # Debug log
        current_app.logger.info(f"Current user id: {current_user.user_id if current_user else 'Not authenticated'}")
        
        # Initiator is the current authenticated user
        initiator_id = current_user.user_id
        
        # Basic validation: cannot trade with yourself
        if initiator_id == recipient_id:
            return jsonify({'error': 'Cannot create a trade with yourself'}), 400
        
        # Check if users follow each other (mutual follow required)
        initiator_follows_recipient = UserFollow.query.filter_by(
            patron_id=initiator_id, 
            artist_id=recipient_id
        ).first()
        
        recipient_follows_initiator = UserFollow.query.filter_by(
            patron_id=recipient_id,
            artist_id=initiator_id
        ).first()
        
        # Debug log
        current_app.logger.info(f"Follow checks: initiator follows recipient: {bool(initiator_follows_recipient)}, recipient follows initiator: {bool(recipient_follows_initiator)}")
        
        if not (initiator_follows_recipient and recipient_follows_initiator):
            return jsonify({
                'error': 'Users must follow each other to trade. Make sure you both follow each other first.'
            }), 403
        
        # Check if initiator owns the offered artwork
        initiator_owns_artwork = Collection.query.filter_by(
            patron_id=initiator_id,
            artwork_id=offered_artwork_id
        ).first()
        
        # Debug log
        current_app.logger.info(f"Initiator owns offered artwork: {bool(initiator_owns_artwork)}")
        
        if not initiator_owns_artwork:
            return jsonify({'error': 'You do not own the artwork you are offering'}), 403
        
        # Check if recipient owns the requested artwork
        recipient_owns_artwork = Collection.query.filter_by(
            patron_id=recipient_id,
            artwork_id=requested_artwork_id
        ).first()
        
        # Debug log
        current_app.logger.info(f"Recipient owns requested artwork: {bool(recipient_owns_artwork)}")
        
        if not recipient_owns_artwork:
            return jsonify({'error': 'The recipient does not own the artwork you are requesting'}), 403
        
        # Check if there's already an active trade with the same artworks
        # Updated to use 'PENDING' in uppercase to match the database enum
        existing_trade = Trade.query.filter(
            and_(
                Trade.status == 'PENDING',
                or_(
                    and_(
                        Trade.initiator_id == initiator_id,
                        Trade.recipient_id == recipient_id,
                        Trade.offered_artwork_id == offered_artwork_id,
                        Trade.requested_artwork_id == requested_artwork_id
                    ),
                    and_(
                        Trade.initiator_id == recipient_id,
                        Trade.recipient_id == initiator_id,
                        Trade.offered_artwork_id == requested_artwork_id,
                        Trade.requested_artwork_id == offered_artwork_id
                    )
                )
            )
        ).first()
        
        # Debug log
        current_app.logger.info(f"Existing similar trade found: {bool(existing_trade)}")
        
        if existing_trade:
            return jsonify({'error': 'A similar trade already exists'}), 409
        
        # Create new trade
        # Updated to use 'PENDING' in uppercase to match the database enum
        new_trade = Trade(
            initiator_id=initiator_id,
            recipient_id=recipient_id,
            offered_artwork_id=offered_artwork_id,
            requested_artwork_id=requested_artwork_id,
            message=message,
            status='PENDING'
        )
        
        try:
            db.session.add(new_trade)
            db.session.commit()
            # --- MODIFIED RESPONSE: Return only essential trade info --- 
            return jsonify({
                'message': 'Trade offer created successfully',
                'trade': {
                    'trade_id': new_trade.trade_id,
                    'status': new_trade.status,
                    'initiator_id': new_trade.initiator_id,
                    'recipient_id': new_trade.recipient_id,
                    'offered_artwork_id': new_trade.offered_artwork_id,
                    'requested_artwork_id': new_trade.requested_artwork_id
                }
            }), 201
            # --- END MODIFICATION ---
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Database error creating trade: {str(e)}")
            return jsonify({'error': f'Database error: {str(e)}'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Unexpected error in create_trade: {str(e)}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred while processing your trade request'}), 500

@trades_bp.route('/trades/<int:trade_id>/accept', methods=['POST'])
@jwt_required()
def accept_trade(trade_id):
    """Accept a pending trade offer"""
    # Get the trade by ID
    trade = Trade.query.get(trade_id)
    
    if not trade:
        return jsonify({'error': 'Trade not found'}), 404
    
    # Verify the current user is the recipient
    if trade.recipient_id != current_user.user_id:
        return jsonify({'error': 'Only the recipient can accept this trade'}), 403
    
    # Use the new execute_trade method for safer transaction handling
    success, message = Trade.execute_trade(trade_id)
    
    if success:
        return jsonify({
            'message': message,
            'trade': trade.to_dict()
        }), 200
    else:
        return jsonify({'error': message}), 400

@trades_bp.route('/trades/<int:trade_id>/reject', methods=['POST'])
@jwt_required()
def reject_trade(trade_id):
    """Reject a pending trade offer"""
    # Get the trade by ID
    trade = Trade.query.get(trade_id)
    
    if not trade:
        return jsonify({'error': 'Trade not found'}), 404
    
    # Verify the current user is the recipient
    if trade.recipient_id != current_user.user_id:
        return jsonify({'error': 'Only the recipient can reject this trade'}), 403
    
    # Check if trade is in pending status - using uppercase 'PENDING'
    if trade.status != 'PENDING':
        return jsonify({'error': f'Cannot reject a trade with status: {trade.status}'}), 400
    
    # Update trade status to rejected - using uppercase 'REJECTED'
    trade.status = 'REJECTED'
    
    try:
        db.session.commit()
        return jsonify({
            'message': 'Trade offer rejected',
            'trade': trade.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error rejecting trade: {str(e)}")
        return jsonify({'error': 'Failed to reject trade offer'}), 500

@trades_bp.route('/trades/<int:trade_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_trade(trade_id):
    """Cancel your own pending trade offer"""
    # Get the trade by ID
    trade = Trade.query.get(trade_id)
    
    if not trade:
        return jsonify({'error': 'Trade not found'}), 404
    
    # Verify the current user is the initiator
    if trade.initiator_id != current_user.user_id:
        return jsonify({'error': 'Only the initiator can cancel this trade'}), 403
    
    # Check if trade is in pending status - using uppercase 'PENDING'
    if trade.status != 'PENDING':
        return jsonify({'error': f'Cannot cancel a trade with status: {trade.status}'}), 400
    
    # Update trade status to canceled - using uppercase 'CANCELED'
    trade.status = 'CANCELED'
    
    try:
        db.session.commit()
        return jsonify({
            'message': 'Trade offer canceled',
            'trade': trade.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error canceling trade: {str(e)}")
        return jsonify({'error': 'Failed to cancel trade offer'}), 500

@trades_bp.route('/trades/sent', methods=['GET'])
@jwt_required()
def get_sent_trades():
    """Get all trade offers sent by the current user"""
    try:
        status_filter = request.args.get('status', None)
        
        query = Trade.query.filter(Trade.initiator_id == current_user.user_id)
        
        if status_filter:
            query = query.filter(Trade.status == status_filter.upper())
        
        trades = query.order_by(Trade.created_at.desc()).all()
        
        # --- MANUAL SERIALIZATION --- 
        trades_data = []
        for trade in trades:
            initiator_info = { "user_id": trade.initiator.user_id, "username": trade.initiator.username } if trade.initiator else {}
            recipient_info = { "user_id": trade.recipient.user_id, "username": trade.recipient.username } if trade.recipient else {}
            offered_artwork_info = {
                "artwork_id": trade.offered_artwork.artwork_id,
                "title": trade.offered_artwork.title,
                "thumbnail_url": trade.offered_artwork.thumbnail_url
            } if trade.offered_artwork else {}
            requested_artwork_info = {
                "artwork_id": trade.requested_artwork.artwork_id,
                "title": trade.requested_artwork.title,
                "thumbnail_url": trade.requested_artwork.thumbnail_url
            } if trade.requested_artwork else {}

            trades_data.append({
                "trade_id": trade.trade_id,
                "initiator_id": trade.initiator_id,
                "recipient_id": trade.recipient_id,
                "offered_artwork_id": trade.offered_artwork_id,
                "requested_artwork_id": trade.requested_artwork_id,
                "message": trade.message,
                "status": trade.status,
                "created_at": trade.created_at.isoformat() + 'Z' if trade.created_at else None,
                "updated_at": trade.updated_at.isoformat() + 'Z' if trade.updated_at else None,
                "initiator": initiator_info,
                "recipient": recipient_info,
                "offered_artwork": offered_artwork_info,
                "requested_artwork": requested_artwork_info
            })
        # --- END MANUAL SERIALIZATION ---

        return jsonify({'trades': trades_data}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching sent trades: {str(e)}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred while fetching sent trades.'}), 500

@trades_bp.route('/trades/received', methods=['GET'])
@jwt_required()
def get_received_trades():
    """Get all trade offers received by the current user"""
    try:
        status_filter = request.args.get('status', None)
        
        query = Trade.query.filter(Trade.recipient_id == current_user.user_id)
        
        if status_filter:
            query = query.filter(Trade.status == status_filter.upper())
        
        trades = query.order_by(Trade.created_at.desc()).all()
        
        # --- MANUAL SERIALIZATION --- 
        trades_data = []
        for trade in trades:
            initiator_info = { "user_id": trade.initiator.user_id, "username": trade.initiator.username } if trade.initiator else {}
            recipient_info = { "user_id": trade.recipient.user_id, "username": trade.recipient.username } if trade.recipient else {}
            offered_artwork_info = {
                "artwork_id": trade.offered_artwork.artwork_id,
                "title": trade.offered_artwork.title,
                "thumbnail_url": trade.offered_artwork.thumbnail_url
            } if trade.offered_artwork else {}
            requested_artwork_info = {
                "artwork_id": trade.requested_artwork.artwork_id,
                "title": trade.requested_artwork.title,
                "thumbnail_url": trade.requested_artwork.thumbnail_url
            } if trade.requested_artwork else {}

            trades_data.append({
                "trade_id": trade.trade_id,
                "initiator_id": trade.initiator_id,
                "recipient_id": trade.recipient_id,
                "offered_artwork_id": trade.offered_artwork_id,
                "requested_artwork_id": trade.requested_artwork_id,
                "message": trade.message,
                "status": trade.status,
                "created_at": trade.created_at.isoformat() + 'Z' if trade.created_at else None,
                "updated_at": trade.updated_at.isoformat() + 'Z' if trade.updated_at else None,
                "initiator": initiator_info,
                "recipient": recipient_info,
                "offered_artwork": offered_artwork_info,
                "requested_artwork": requested_artwork_info
            })
        # --- END MANUAL SERIALIZATION ---

        return jsonify({'trades': trades_data}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching received trades: {str(e)}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred while fetching received trades.'}), 500

@trades_bp.route('/trades/<int:trade_id>', methods=['GET'])
@jwt_required()
def get_trade_details(trade_id):
    """Get details of a specific trade"""
    trade = Trade.query.get(trade_id)
    
    if not trade:
        return jsonify({'error': 'Trade not found'}), 404
    
    # Verify the current user is either the initiator or recipient
    if trade.initiator_id != current_user.user_id and trade.recipient_id != current_user.user_id:
        return jsonify({'error': 'You do not have permission to view this trade'}), 403
    
    return jsonify({
        'trade': trade.to_dict()
    }), 200