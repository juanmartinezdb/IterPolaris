# backend/app/api/quest_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, PoolMission, ScheduledMission, HabitTemplate, HabitOccurrence, Tag
from app.auth_utils import token_required
import uuid
from datetime import date, time, datetime, timezone 
from sqlalchemy import and_ 
import re

quest_bp = Blueprint('quest_bp', __name__, url_prefix='/api/quests')

def is_valid_hex_color(color_string):
    if not color_string: 
        return True 
    pattern = re.compile(r'^#(?:[0-9a-fA-F]{3}){1,2}$')
    return bool(pattern.match(color_string))

@quest_bp.route('', methods=['POST'], endpoint='create_quest_ep')
@token_required
def create_quest():
    data = request.get_json()
    current_user = g.current_user
    name = data.get('name')
    description = data.get('description', None) 
    color = data.get('color', '#FFFFFF')       

    if not name: return jsonify({"error": "Quest name is required"}), 400
    if not isinstance(name, str) or (description and not isinstance(description, str)) or not isinstance(color, str) :
        return jsonify({"error": "Invalid data type for fields"}), 400
    if not is_valid_hex_color(color): return jsonify({"error": "Invalid HEX color format. Use #RRGGBB or #RGB."}), 400
    if len(name.strip()) == 0 : return jsonify({"error": "Quest name cannot be empty"}), 400
    if len(name) > 100: return jsonify({"error": "Quest name is too long (max 100 characters)"}), 400
    if description and len(description) > 500: return jsonify({"error": "Quest description is too long (max 500 characters)"}), 400

    existing_quest = Quest.query.filter_by(user_id=current_user.id, name=name.strip()).first()
    if existing_quest: return jsonify({"error": f"A Quest with the name '{name.strip()}' already exists."}), 409

    try:
        new_quest = Quest(
            user_id=current_user.id, name=name.strip(),
            description=description.strip() if description else None, color=color
        )
        db.session.add(new_quest); db.session.commit()
        return jsonify({
            "id": str(new_quest.id), "name": new_quest.name, "description": new_quest.description,
            "color": new_quest.color, "is_default_quest": new_quest.is_default_quest,
            "created_at": new_quest.created_at.isoformat(), "updated_at": new_quest.updated_at.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error creating quest for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to create quest due to an internal error"}), 500

@quest_bp.route('', methods=['GET'], endpoint='get_quests_ep')
@token_required
def get_quests():
    current_user = g.current_user
    try:
        quests = Quest.query.filter_by(user_id=current_user.id).order_by(Quest.is_default_quest.desc(), Quest.created_at.asc()).all()
        quests_data = [{
            "id": str(quest.id),"name": quest.name, "description": quest.description, "color": quest.color,
            "is_default_quest": quest.is_default_quest, "created_at": quest.created_at.isoformat(),
            "updated_at": quest.updated_at.isoformat()
        } for quest in quests]
        return jsonify(quests_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching quests for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch quests due to an internal error"}), 500

@quest_bp.route('/<uuid:quest_id>', methods=['GET'], endpoint='get_quest_ep')
@token_required
def get_quest(quest_id):
    current_user = g.current_user
    try:
        quest = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()
        if not quest: return jsonify({"error": "Quest not found or access denied"}), 404
        return jsonify({
            "id": str(quest.id), "name": quest.name, "description": quest.description, "color": quest.color,
            "is_default_quest": quest.is_default_quest, "created_at": quest.created_at.isoformat(),
            "updated_at": quest.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch quest due to an internal error"}), 500

@quest_bp.route('/<uuid:quest_id>', methods=['PUT'], endpoint='update_quest_ep')
@token_required
def update_quest(quest_id):
    data = request.get_json(); current_user = g.current_user
    name = data.get('name'); description = data.get('description'); color = data.get('color')

    if not name and description is None and not color : return jsonify({"error": "No update data provided."}), 400
    if name is not None and not isinstance(name, str): return jsonify({"error": "Invalid data type for name"}), 400
    if description is not None and not isinstance(description, str): return jsonify({"error": "Invalid data type for description"}), 400
    if color is not None and (not isinstance(color, str) or not is_valid_hex_color(color)): return jsonify({"error": "Invalid data type or HEX color format for color"}), 400
    if name is not None and len(name.strip()) == 0: return jsonify({"error": "Quest name cannot be empty if provided"}), 400
    if name and len(name) > 100: return jsonify({"error": "Quest name is too long (max 100 characters)"}), 400
    if description and len(description) > 500: return jsonify({"error": "Quest description is too long (max 500 characters)"}), 400
    try:
        quest_to_update = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()
        if not quest_to_update: return jsonify({"error": "Quest not found or access denied"}), 404
        if name and name.strip() != quest_to_update.name:
            existing_quest_with_new_name = Quest.query.filter(
                Quest.user_id == current_user.id, Quest.name == name.strip(), Quest.id != quest_id
            ).first()
            if existing_quest_with_new_name: return jsonify({"error": f"A Quest with the name '{name.strip()}' already exists."}), 409
        
        if name is not None: quest_to_update.name = name.strip()
        if description is not None: quest_to_update.description = description.strip() if description.strip() else None
        if color is not None: quest_to_update.color = color
        db.session.commit()
        return jsonify({
            "id": str(quest_to_update.id), "name": quest_to_update.name, "description": quest_to_update.description,
            "color": quest_to_update.color, "is_default_quest": quest_to_update.is_default_quest,
            "updated_at": quest_to_update.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error updating quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to update quest due to an internal error"}), 500

@quest_bp.route('/<uuid:quest_id>', methods=['DELETE'], endpoint='delete_quest_ep')
@token_required
def delete_quest(quest_id):
    current_user = g.current_user
    try:
        quest_to_delete = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()
        if not quest_to_delete: return jsonify({"error": "Quest not found or access denied"}), 404
        if quest_to_delete.is_default_quest: return jsonify({"error": "The default Quest cannot be deleted."}), 403
        generic_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not generic_quest:
            current_app.logger.error(f"User {current_user.id} does not have a default Quest for task reassignment.")
            return jsonify({"error": "Default Quest not found. Cannot delete Quest."}), 500
        if generic_quest.id == quest_to_delete.id: # Should not happen if default cannot be deleted
            current_app.logger.error(f"Attempted to reassign tasks to the quest being deleted (default quest {quest_to_delete.id}).")
            return jsonify({"error": "Critical error: Cannot reassign tasks to the quest being deleted."}), 500
        
        PoolMission.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        ScheduledMission.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        HabitTemplate.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        HabitOccurrence.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        
        quest_name_deleted = quest_to_delete.name
        db.session.delete(quest_to_delete); db.session.commit()
        return jsonify({"message": f"Quest '{quest_name_deleted}' deleted. Tasks reassigned to '{generic_quest.name}'."}), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error deleting quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to delete quest due to an internal error"}), 500

@quest_bp.route('/<uuid:quest_id>/dashboard-items', methods=['GET'], endpoint='get_quest_dashboard_items_ep')
@token_required
def get_quest_dashboard_items(quest_id):
    current_user = g.current_user
    tag_ids_param = request.args.getlist('tags')

    quest = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()
    if not quest:
        return jsonify({"error": "Quest not found or access denied"}), 404

    try:
        today_start_utc = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
        today_end_utc = datetime.combine(date.today(), time.max, tzinfo=timezone.utc)

        valid_tag_uuids_for_filter = []
        if tag_ids_param:
            for tid_str in tag_ids_param:
                for tid in tid_str.split(','):
                    if tid.strip():
                        try: valid_tag_uuids_for_filter.append(uuid.UUID(tid.strip()))
                        except ValueError: current_app.logger.warning(f"Invalid UUID format for tag filter: {tid}")
        
        # 1. Today's Habit Occurrences
        ho_query = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter(
            HabitOccurrence.user_id == current_user.id,
            HabitOccurrence.quest_id == quest_id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= today_start_utc,
            HabitOccurrence.scheduled_start_datetime <= today_end_utc
        )
        if valid_tag_uuids_for_filter:
            ho_query = ho_query.join(HabitTemplate, HabitOccurrence.habit_template_id == HabitTemplate.id)
            for tag_uuid_item in valid_tag_uuids_for_filter:
                ho_query = ho_query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))
        
        todays_habits_results = ho_query.order_by(HabitOccurrence.scheduled_start_datetime.asc()).all()
        todays_habit_occurrences = [{
            "id": str(ho.id), "title": ho.title, "status": ho.status,
            "scheduled_start_datetime": ho.scheduled_start_datetime.isoformat(),
            "scheduled_end_datetime": ho.scheduled_end_datetime.isoformat(),
            "energy_value": ho.energy_value, "points_value": ho.points_value,
            "quest_id": str(ho.quest_id), "quest_name": quest.name,
            "type": "HABIT_OCCURRENCE",
            "rec_duration_minutes": ho.template.rec_duration_minutes if ho.template else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in ho.template.tags] if ho.template else []
        } for ho in todays_habits_results]

        # 2. Pending Scheduled Missions (today and future)
        sm_query = ScheduledMission.query.options(db.selectinload(ScheduledMission.tags)).filter(
            ScheduledMission.user_id == current_user.id,
            ScheduledMission.quest_id == quest_id,
            ScheduledMission.status == 'PENDING',
            ScheduledMission.start_datetime >= today_start_utc
        )
        if valid_tag_uuids_for_filter:
            for tag_uuid_item in valid_tag_uuids_for_filter:
                sm_query = sm_query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))
        
        scheduled_missions_results = sm_query.order_by(ScheduledMission.start_datetime.asc()).limit(10).all()
        pending_scheduled_missions = [{
            "id": str(sm.id), "title": sm.title, "status": sm.status,
            "start_datetime": sm.start_datetime.isoformat(), "end_datetime": sm.end_datetime.isoformat(),
            "is_all_day": sm.is_all_day, "energy_value": sm.energy_value, "points_value": sm.points_value,
            "quest_id": str(sm.quest_id), "quest_name": quest.name, "type": "SCHEDULED_MISSION",
            "tags": [{"id": str(t.id), "name": t.name} for t in sm.tags]
        } for sm in scheduled_missions_results]

        # 3. Pending Pool Missions
        pm_query = PoolMission.query.options(db.selectinload(PoolMission.tags)).filter(
            PoolMission.user_id == current_user.id, PoolMission.quest_id == quest_id, PoolMission.status == 'PENDING'
        )
        if valid_tag_uuids_for_filter:
            for tag_uuid_item in valid_tag_uuids_for_filter:
                pm_query = pm_query.filter(PoolMission.tags.any(Tag.id == tag_uuid_item))
        
        pool_missions_results = pm_query.order_by(
            db.case((PoolMission.focus_status == 'ACTIVE', 0), else_=1), PoolMission.created_at.desc()
        ).limit(10).all()
        pending_pool_missions = [{
            "id": str(pm.id), "title": pm.title, "status": pm.status, "focus_status": pm.focus_status,
            "energy_value": pm.energy_value, "points_value": pm.points_value,
            "quest_id": str(pm.quest_id), "quest_name": quest.name, "type": "POOL_MISSION",
            "tags": [{"id": str(t.id), "name": t.name} for t in pm.tags]
        } for pm in pool_missions_results]

        return jsonify({
            "quest_info": {"id": str(quest.id), "name": quest.name, "color": quest.color},
            "todays_habit_occurrences": todays_habit_occurrences,
            "pending_scheduled_missions": pending_scheduled_missions,
            "pending_pool_missions": pending_pool_missions
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching dashboard items for quest {quest_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch quest dashboard items"}), 500