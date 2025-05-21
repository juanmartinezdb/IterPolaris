# backend/app/api/energy_log_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, EnergyLog
from app.auth_utils import token_required
from sqlalchemy import desc # For ordering

energy_log_bp = Blueprint('energy_log_bp', __name__, url_prefix='/api/energy-log')

@energy_log_bp.route('', methods=['GET'])
@token_required
def get_energy_logs():
    current_user = g.current_user
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int) # Default to 10 logs per page
    source_type_filter = request.args.get('source_type') # Optional filter

    try:
        query = EnergyLog.query.filter_by(user_id=current_user.id)

        if source_type_filter and source_type_filter.upper() in ['POOL_MISSION', 'SCHEDULED_MISSION', 'HABIT_OCCURRENCE']:
            query = query.filter(EnergyLog.source_entity_type == source_type_filter.upper())

        paginated_logs = query.order_by(desc(EnergyLog.created_at)).paginate(page=page, per_page=per_page, error_out=False)
        
        logs_data = [{
            "id": str(log.id),
            "source_entity_type": log.source_entity_type,
            "source_entity_id": str(log.source_entity_id) if log.source_entity_id else None,
            "energy_value": log.energy_value,
            "reason_text": log.reason_text,
            "created_at": log.created_at.isoformat()
        } for log in paginated_logs.items]
        
        return jsonify({
            "logs": logs_data,
            "total_logs": paginated_logs.total,
            "current_page": paginated_logs.page,
            "total_pages": paginated_logs.pages,
            "has_next": paginated_logs.has_next,
            "has_prev": paginated_logs.has_prev
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching energy logs for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch energy logs due to an internal error"}), 500

# Note: POST endpoint for creating EnergyLog entries is intentionally omitted
# as logs are created internally upon mission completion.