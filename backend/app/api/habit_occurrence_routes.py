# backend/app/api/habit_occurrence_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, HabitTemplate, HabitOccurrence, EnergyLog, Quest, Tag # Tag importado
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date
from app.services.gamification_services import update_user_stats_after_mission

habit_occurrence_bp = Blueprint('habit_occurrence_bp', __name__, url_prefix='/api/habit-occurrences')

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
    
    template_id_str = request.args.get('template_id')
    status_filter = request.args.get('status')
    start_date_filter_str = request.args.get('start_date') 
    end_date_filter_str = request.args.get('end_date')
    tag_ids_param = request.args.getlist('tags') # Para manejar múltiples 'tags' query params

    try:
        query = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest),
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags) # Eager load template y sus tags
        ).filter_by(user_id=current_user.id)

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
            # Filtro para ocurrencias cuyo día (basado en scheduled_start_datetime) es >= start_date_obj
            query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) >= start_date_obj)
        if end_date_obj:
            # Filtro para ocurrencias cuyo día es <= end_date_obj
            query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) <= end_date_obj)
        
        if tag_ids_param:
            valid_tag_uuids = []
            for tid_str in tag_ids_param:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    current_app.logger.warning(f"Invalid tag_id format in tags filter for habit occurrences: {tid_str}")
            
            if valid_tag_uuids:
                # Unir con HabitTemplate si aún no se ha hecho explícitamente (aunque joinedload ya lo hace para la carga)
                # query = query.join(HabitTemplate, HabitOccurrence.habit_template_id == HabitTemplate.id)
                # Para que la ocurrencia (a través de su plantilla) tenga TODOS los tags provistos:
                for tag_uuid_item in valid_tag_uuids:
                    query = query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))
            
        occurrences = query.order_by(HabitOccurrence.scheduled_start_datetime.asc()).all()
        
        occurrences_data = []
        for occ in occurrences:
            duration_minutes = occ.template.rec_duration_minutes if occ.template else None
            template_tags_data = []
            if occ.template and occ.template.tags: # Check if template and its tags exist
                template_tags_data = [{"id": str(t.id), "name": t.name} for t in occ.template.tags]

            occurrences_data.append({
                "id": str(occ.id),
                "habit_template_id": str(occ.habit_template_id),
                "user_id": str(occ.user_id),
                "quest_id": str(occ.quest_id) if occ.quest_id else None,
                "quest_name": occ.quest.name if occ.quest else None,
                "title": occ.title,
                "description": occ.description, 
                "rec_duration_minutes": duration_minutes,
                "energy_value": occ.energy_value,
                "points_value": occ.points_value,
                "scheduled_start_datetime": occ.scheduled_start_datetime.isoformat(),
                "scheduled_end_datetime": occ.scheduled_end_datetime.isoformat(),
                "status": occ.status,
                "actual_completion_datetime": occ.actual_completion_datetime.isoformat() if occ.actual_completion_datetime else None,
                "tags": template_tags_data, # Incluir los tags de la plantilla
                "created_at": occ.created_at.isoformat(),
                "updated_at": occ.updated_at.isoformat(),
                "template": { # Añadir info del template si es útil para el frontend (ej. para mostrar tags)
                    "id": str(occ.template.id) if occ.template else None,
                    "tags": template_tags_data # Repetir aquí o frontend puede usar el nivel superior
                } if occ.template else None
            })
        return jsonify(occurrences_data), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching habit occurrences for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch habit occurrences"}), 500


@habit_occurrence_bp.route('/<uuid:occurrence_id>/status', methods=['PATCH'])
@token_required
def update_habit_occurrence_status(occurrence_id):
    data = request.get_json()
    current_user = g.current_user # type: User
    new_status = data.get('status')

    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid or missing status. Must be 'PENDING', 'COMPLETED', or 'SKIPPED'."}), 400

    try:
        # Eager load para tener acceso a quest y template.tags para la respuesta
        occurrence = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest),
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter_by(id=occurrence_id, user_id=current_user.id).first()
        
        if not occurrence:
            return jsonify({"error": "Habit Occurrence not found or access denied"}), 404

        old_status = occurrence.status
        
        if old_status == new_status.upper(): # No change
            quest_name_val = occurrence.quest.name if occurrence.quest else None
            duration_minutes = occurrence.template.rec_duration_minutes if occurrence.template else None
            template_tags_data = [{"id": str(t.id), "name": t.name} for t in occurrence.template.tags] if occurrence.template else []
            
            return jsonify({
                "id": str(occurrence.id), "habit_template_id": str(occurrence.habit_template_id),
                "title": occurrence.title, "description": occurrence.description,
                "rec_duration_minutes": duration_minutes,
                "energy_value": occurrence.energy_value, "points_value": occurrence.points_value,
                "scheduled_start_datetime": occurrence.scheduled_start_datetime.isoformat(),
                "scheduled_end_datetime": occurrence.scheduled_end_datetime.isoformat(),
                "status": occurrence.status,
                "actual_completion_datetime": occurrence.actual_completion_datetime.isoformat() if occurrence.actual_completion_datetime else None,
                "quest_id": str(occurrence.quest_id) if occurrence.quest_id else None,
                "quest_name": quest_name_val,
                "tags": template_tags_data,
                "user_total_points": current_user.total_points, "user_level": current_user.level,
                "updated_at": occurrence.updated_at.isoformat()
            }), 200

        occurrence.status = new_status.upper()
        
        points_change = 0
        log_reason = None
        is_completion_event = False # True para nueva completitud, False para reversión

        if occurrence.status == 'COMPLETED':
            occurrence.actual_completion_datetime = datetime.now(timezone.utc)
            if old_status != 'COMPLETED': # Solo aplicar cambios si realmente se está completando (no de COMPLETED a COMPLETED)
                points_change = occurrence.points_value
                log_reason = f"Completed Habit: {occurrence.title}"
                is_completion_event = True
        elif old_status == 'COMPLETED' and (occurrence.status == 'PENDING' or occurrence.status == 'SKIPPED'): # Reversión DESDE COMPLETADO
            occurrence.actual_completion_datetime = None # Limpiar fecha de completitud
            points_change = -occurrence.points_value
            log_reason = f"Reverted Habit Occurrence completion: {occurrence.title}"
            is_completion_event = False # Esto es una reversión
        elif occurrence.status != 'COMPLETED': # e.g., PENDING to SKIPPED or SKIPPED to PENDING
            occurrence.actual_completion_datetime = None # Limpiar si no es completado
        
        if log_reason: # Solo llamar si hay cambio de puntos/energía que registrar
            update_user_stats_after_mission(
                user=current_user,
                points_to_change=points_change,
                energy_value_for_log=occurrence.energy_value, # Energía original de la ocurrencia
                source_entity_type='HABIT_OCCURRENCE',
                source_entity_id=occurrence.id,
                reason_text=log_reason,
                is_completion=is_completion_event
            )
            
        db.session.commit()
        
        quest_name_val = occurrence.quest.name if occurrence.quest else None
        duration_minutes = occurrence.template.rec_duration_minutes if occurrence.template else None
        template_tags_data = [{"id": str(t.id), "name": t.name} for t in occurrence.template.tags] if occurrence.template else []

        return jsonify({
            "id": str(occurrence.id),
            "habit_template_id": str(occurrence.habit_template_id),
            "title": occurrence.title, "description": occurrence.description,
            "rec_duration_minutes": duration_minutes,
            "energy_value": occurrence.energy_value, "points_value": occurrence.points_value,
            "scheduled_start_datetime": occurrence.scheduled_start_datetime.isoformat(),
            "scheduled_end_datetime": occurrence.scheduled_end_datetime.isoformat(),
            "status": occurrence.status,
            "actual_completion_datetime": occurrence.actual_completion_datetime.isoformat() if occurrence.actual_completion_datetime else None,
            "quest_id": str(occurrence.quest_id) if occurrence.quest_id else None,
            "quest_name": quest_name_val,
            "tags": template_tags_data,
            "user_total_points": current_user.total_points, # Devolver stats actualizadas
            "user_level": current_user.level,
            "updated_at": occurrence.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating status for habit occurrence {occurrence_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update habit occurrence status"}), 500


@habit_occurrence_bp.route('/<uuid:occurrence_id>/undo-completion', methods=['PATCH'])
@token_required
def undo_habit_occurrence_completion(occurrence_id):
    current_user = g.current_user
    occurrence = HabitOccurrence.query.filter_by(id=occurrence_id, user_id=current_user.id).first()
    if not occurrence: return jsonify({"error": "Habit Occurrence not found"}), 404
    if occurrence.status != 'COMPLETED': return jsonify({"error": "Habit is not marked as completed"}), 400

    try:
        occurrence.status = 'PENDING'
        occurrence.actual_completion_datetime = None # Clear completion time
        # Revert points and deactivate energy log entry
        update_user_stats_after_mission(
            user=current_user,
            points_to_change=-occurrence.points_value,
            energy_value_for_log=occurrence.energy_value,
            source_entity_type='HABIT_OCCURRENCE',
            source_entity_id=occurrence.id,
            reason_text=f"Undo completion of Habit: {occurrence.title}",
            is_completion=False
        )
        db.session.commit()
        return jsonify({
            "message": "Habit Occurrence completion undone.",
            "user_total_points": current_user.total_points,
            "user_level": current_user.level
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error undoing HO {occurrence.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to undo habit completion"}), 500