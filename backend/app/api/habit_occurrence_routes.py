# backend/app/api/habit_occurrence_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, HabitTemplate, HabitOccurrence, EnergyLog, Quest # Added Quest
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date # Added date

habit_occurrence_bp = Blueprint('habit_occurrence_bp', __name__, url_prefix='/api/habit-occurrences')

# Helper para parsear fechas de query params
def parse_date_param(date_str):
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except ValueError:
        return None

@habit_occurrence_bp.route('', methods=['GET'])
@token_required
def get_habit_occurrences():
    current_user = g.current_user
    
    # Parámetros de filtro
    template_id_str = request.args.get('template_id')
    status_filter = request.args.get('status')
    start_date_filter_str = request.args.get('start_date') # Filtra por scheduled_start_datetime >= start_date
    end_date_filter_str = request.args.get('end_date')     # Filtra por scheduled_start_datetime <= end_date
    # Podríamos añadir más filtros como quest_id si es necesario

    try:
        query = HabitOccurrence.query.filter_by(user_id=current_user.id)

        if template_id_str:
            try:
                template_uuid = uuid.UUID(template_id_str)
                query = query.filter(HabitOccurrence.habit_template_id == template_uuid)
            except ValueError:
                return jsonify({"error": "Invalid template_id format"}), 400
        
        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED', 'SKIPPED']:
            query = query.filter(HabitOccurrence.status == status_filter.upper())

        start_date_obj = parse_date_param(start_date_filter_str)
        end_date_obj = parse_date_param(end_date_filter_str)

        if start_date_obj:
            # Compara la parte de la fecha de scheduled_start_datetime
            query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) >= start_date_obj)
        if end_date_obj:
            query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) <= end_date_obj)
            
        occurrences = query.order_by(HabitOccurrence.scheduled_start_datetime.asc()).all()
        
        occurrences_data = []
        for occ in occurrences:
            quest_name_val = occ.quest.name if occ.quest else None # Asumiendo que occ.quest está disponible
            occurrences_data.append({
                "id": str(occ.id),
                "habit_template_id": str(occ.habit_template_id),
                "user_id": str(occ.user_id),
                "quest_id": str(occ.quest_id) if occ.quest_id else None,
                "quest_name": quest_name_val,
                "title": occ.title,
                "description": occ.description,
                "energy_value": occ.energy_value,
                "points_value": occ.points_value,
                "scheduled_start_datetime": occ.scheduled_start_datetime.isoformat(),
                "scheduled_end_datetime": occ.scheduled_end_datetime.isoformat(),
                "status": occ.status,
                "actual_completion_datetime": occ.actual_completion_datetime.isoformat() if occ.actual_completion_datetime else None,
                "created_at": occ.created_at.isoformat(),
                "updated_at": occ.updated_at.isoformat()
            })
        return jsonify(occurrences_data), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching habit occurrences for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch habit occurrences"}), 500


@habit_occurrence_bp.route('/<uuid:occurrence_id>/status', methods=['PATCH'])
@token_required
def update_habit_occurrence_status(occurrence_id):
    data = request.get_json()
    current_user = g.current_user
    new_status = data.get('status')

    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid or missing status. Must be 'PENDING', 'COMPLETED', or 'SKIPPED'."}), 400

    try:
        occurrence = HabitOccurrence.query.filter_by(id=occurrence_id, user_id=current_user.id).first()
        if not occurrence:
            return jsonify({"error": "Habit Occurrence not found or access denied"}), 404

        old_status = occurrence.status
        occurrence.status = new_status.upper()

        if occurrence.status == 'COMPLETED':
            occurrence.actual_completion_datetime = datetime.now(timezone.utc)
            # Log energy if it wasn't completed before
            if old_status != 'COMPLETED':
                energy_log_entry = EnergyLog(
                    user_id=current_user.id,
                    source_entity_type='HABIT_OCCURRENCE',
                    source_entity_id=occurrence.id,
                    energy_value=occurrence.energy_value,
                    reason_text=f"Completed Habit: {occurrence.title}"
                )
                db.session.add(energy_log_entry)
                # User points update will be in Task 8
        elif old_status == 'COMPLETED' and occurrence.status != 'COMPLETED': # Undoing completion
             occurrence.actual_completion_datetime = None
             # Placeholder: Potentially remove or negate energy log entry (complex, for later if needed)
             current_app.logger.info(f"Habit occurrence {occurrence.id} status changed from COMPLETED. Energy log might need adjustment (not implemented).")


        db.session.commit()
        quest_name_val = occurrence.quest.name if occurrence.quest else None
        return jsonify({
            "id": str(occurrence.id),
            "habit_template_id": str(occurrence.habit_template_id),
            "title": occurrence.title,
            "description": occurrence.description,
            "energy_value": occurrence.energy_value,
            "points_value": occurrence.points_value,
            "scheduled_start_datetime": occurrence.scheduled_start_datetime.isoformat(),
            "scheduled_end_datetime": occurrence.scheduled_end_datetime.isoformat(),
            "status": occurrence.status,
            "actual_completion_datetime": occurrence.actual_completion_datetime.isoformat() if occurrence.actual_completion_datetime else None,
            "quest_id": str(occurrence.quest_id) if occurrence.quest_id else None,
            "quest_name": quest_name_val,
            "updated_at": occurrence.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating status for habit occurrence {occurrence_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update habit occurrence status"}), 500

# El endpoint POST /api/habit-templates/<uuid:template_id>/generate-occurrences
# se implementará como parte de Subtask 7.5 (Occurrence Generation Logic)
# ya que está directamente relacionado con la lógica de generación.
# Lo añadiremos al blueprint habit_template_bp o aquí según convenga.
# Por ahora, dejaremos un placeholder o lo crearemos en el archivo de habit_template_routes.py
# para mantener la lógica de generación de ocurrencias más centralizada con la plantilla.
# Decido ponerlo en `habit_template_routes.py` para mantener la lógica de generación ligada a la plantilla.