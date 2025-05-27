# backend/app/api/habit_occurrence_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, HabitTemplate, HabitOccurrence, EnergyLog, Quest, Tag 
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date
from app.services.gamification_services import update_user_stats_after_mission

habit_occurrence_bp = Blueprint('habit_occurrence_bp', __name__, url_prefix='/api/habit-occurrences')

def parse_date_param(date_str):
    if not date_str: return None
    try: return date.fromisoformat(date_str)
    except ValueError: return None

@habit_occurrence_bp.route('', methods=['GET'])
@token_required
def get_habit_occurrences():
    current_user = g.current_user
    template_id_str = request.args.get('template_id')
    status_filter = request.args.get('status')
    start_date_filter_str = request.args.get('start_date') 
    end_date_filter_str = request.args.get('end_date')
    tag_ids_param = request.args.getlist('tags')

    try:
        query = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest),
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter_by(user_id=current_user.id)

        if template_id_str:
            try:
                template_uuid = uuid.UUID(template_id_str)
                query = query.filter(HabitOccurrence.habit_template_id == template_uuid)
            except ValueError: return jsonify({"error": "Invalid template_id format"}), 400
        
        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED', 'SKIPPED']:
            query = query.filter(HabitOccurrence.status == status_filter.upper())

        start_date_obj = parse_date_param(start_date_filter_str)
        end_date_obj = parse_date_param(end_date_filter_str)

        if start_date_obj: query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) >= start_date_obj)
        if end_date_obj: query = query.filter(db.func.date(HabitOccurrence.scheduled_start_datetime) <= end_date_obj)
        
        if tag_ids_param:
            valid_tag_uuids = []
            for tid_str in tag_ids_param:
                try: valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError: current_app.logger.warning(f"Invalid tag_id format: {tid_str}")
            if valid_tag_uuids:
                query = query.join(HabitTemplate, HabitOccurrence.habit_template_id == HabitTemplate.id)
                for tag_uuid_item in valid_tag_uuids:
                    query = query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))
            
        occurrences = query.order_by(HabitOccurrence.scheduled_start_datetime.asc()).all()
        
        occurrences_data = []
        for occ in occurrences:
            duration_minutes = occ.template.rec_duration_minutes if occ.template else None
            template_tags_data = [{"id": str(t.id), "name": t.name} for t in occ.template.tags] if occ.template else []
            occurrences_data.append({
                "id": str(occ.id), "habit_template_id": str(occ.habit_template_id),
                "user_id": str(occ.user_id), "quest_id": str(occ.quest_id) if occ.quest_id else None,
                "quest_name": occ.quest.name if occ.quest else None, "title": occ.title,
                "description": occ.description, "rec_duration_minutes": duration_minutes,
                "energy_value": occ.energy_value, "points_value": occ.points_value,
                "scheduled_start_datetime": occ.scheduled_start_datetime.isoformat(),
                "scheduled_end_datetime": occ.scheduled_end_datetime.isoformat(),
                "is_all_day": occ.is_all_day, # <-- NUEVO CAMPO AÑADIDO
                "status": occ.status,
                "actual_completion_datetime": occ.actual_completion_datetime.isoformat() if occ.actual_completion_datetime else None,
                "tags": template_tags_data, "created_at": occ.created_at.isoformat(),
                "updated_at": occ.updated_at.isoformat(),
                "template": { "id": str(occ.template.id) if occ.template else None, "tags": template_tags_data } if occ.template else None
            })
        return jsonify(occurrences_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching habit occurrences for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch habit occurrences"}), 500

@habit_occurrence_bp.route('/<uuid:occurrence_id>/status', methods=['PATCH'])
@token_required
def update_habit_occurrence_status(occurrence_id):
    data = request.get_json(); current_user = g.current_user; new_status = data.get('status')
    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid status."}), 400
    try:
        occurrence = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest),
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter_by(id=occurrence_id, user_id=current_user.id).first()
        if not occurrence: return jsonify({"error": "Habit Occurrence not found"}), 404
        
        old_status = occurrence.status
        if old_status == new_status.upper(): # No change, return current state
            # (omitiendo la duplicación de la respuesta completa aquí por brevedad, pero sería igual que en el success)
            return jsonify({ # Simplified response for no-change, ensure frontend handles this gracefully
                "id": str(occurrence.id), "status": occurrence.status,
                "user_total_points": current_user.total_points, "user_level": current_user.level,
            }), 200

        occurrence.status = new_status.upper()
        points_change = 0; log_reason = None; is_completion_event = False
        if occurrence.status == 'COMPLETED':
            occurrence.actual_completion_datetime = datetime.now(timezone.utc)
            if old_status != 'COMPLETED':
                points_change = occurrence.points_value; log_reason = f"Completed Habit: {occurrence.title}"; is_completion_event = True
        elif old_status == 'COMPLETED':
            occurrence.actual_completion_datetime = None
            points_change = -occurrence.points_value; log_reason = f"Reverted Habit: {occurrence.title}"; is_completion_event = False
        elif occurrence.status != 'COMPLETED':
             occurrence.actual_completion_datetime = None
        
        if log_reason:
            update_user_stats_after_mission(
                current_user, points_change, occurrence.energy_value, 
                'HABIT_OCCURRENCE', occurrence.id, log_reason, is_completion_event
            )
        db.session.commit()

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
            "is_all_day": occurrence.is_all_day, # <-- NUEVO CAMPO AÑADIDO
            "status": occurrence.status,
            "actual_completion_datetime": occurrence.actual_completion_datetime.isoformat() if occurrence.actual_completion_datetime else None,
            "quest_id": str(occurrence.quest_id) if occurrence.quest_id else None,
            "quest_name": quest_name_val, "tags": template_tags_data,
            "user_total_points": current_user.total_points, "user_level": current_user.level,
            "updated_at": occurrence.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error HO status update {occurrence_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update status"}), 500

@habit_occurrence_bp.route('/<uuid:occurrence_id>/undo-completion', methods=['PATCH'])
@token_required
def undo_habit_occurrence_completion(occurrence_id):
    current_user = g.current_user
    occurrence = HabitOccurrence.query.filter_by(id=occurrence_id, user_id=current_user.id).first()
    if not occurrence: return jsonify({"error": "Habit Occurrence not found"}), 404
    if occurrence.status != 'COMPLETED': return jsonify({"error": "Habit is not completed"}), 400
    try:
        occurrence.status = 'PENDING'; occurrence.actual_completion_datetime = None
        update_user_stats_after_mission(
            current_user, -occurrence.points_value, occurrence.energy_value,
            'HABIT_OCCURRENCE', occurrence.id, f"Undo completion of Habit: {occurrence.title}", False
        )
        db.session.commit()
        return jsonify({
            "message": "Habit Occurrence completion undone.",
            "user_total_points": current_user.total_points, "user_level": current_user.level
        }), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error undoing HO {occurrence.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to undo completion"}), 500