# backend/app/api/gamification_routes.py
from flask import Blueprint, jsonify, g, current_app
from app.auth_utils import token_required
from app.services.gamification_services import calculate_energy_balance

gamification_bp = Blueprint('gamification_bp', __name__, url_prefix='/api/gamification')

@gamification_bp.route('/energy-balance', methods=['GET'])
@token_required
def get_energy_balance_status():
    current_user = g.current_user
    try:
        balance_data = calculate_energy_balance(current_user.id)
        return jsonify(balance_data), 200
    except Exception as e:
        current_app.logger.error(f"Error calculating energy balance for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to calculate energy balance"}), 500