# backend/app/api/scheduled_mission_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, ScheduledMission, EnergyLog 
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date # Asegúrate que 'date' esté si lo usas en parse_date_query_param

scheduled_mission_bp = Blueprint('scheduled_mission_bp', __name__, url_prefix='/api/scheduled-missions')

def validate_iso_datetime(dt_str):
    """Valida si un string es un ISO 8601 datetime y lo convierte a objeto datetime con UTC."""
    if not dt_str:
        return None, "Datetime string cannot be empty."
    try:
        if dt_str.endswith('Z'):
            dt_obj = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        elif '+' in dt_str[10:]: 
            dt_obj = datetime.fromisoformat(dt_str)
        else: 
            dt_obj = datetime.fromisoformat(dt_str)
            if dt_obj.tzinfo is None: 
                dt_obj = dt_obj.replace(tzinfo=timezone.utc) 
        
        return dt_obj.astimezone(timezone.utc), None
    except ValueError as e:
        return None, f"Invalid ISO 8601 datetime format: {e}"
    except Exception as e: 
        return None, f"Error parsing datetime: {e}"


def validate_scheduled_mission_data(data, is_update=False):
    """Validates scheduled mission data for POST and PUT requests."""
    errors = {}
    required_fields_on_create = ['title', 'energy_value', 'points_value', 'start_datetime', 'end_datetime']

    if not is_update:
        for field in required_fields_on_create:
            if field not in data or data[field] is None:
                if field not in ['energy_value', 'points_value'] or data.get(field) is None: 
                    errors[field] = f"{field} is required."

    if 'title' in data and (not isinstance(data.get('title'), str) or len(data.get('title', '').strip()) == 0):
        errors['title'] = "Title must be a non-empty string."
    elif 'title' in data and len(data.get('title', '')) > 255:
        errors['title'] = "Title is too long (max 255 characters)."

    if 'description' in data and data.get('description') is not None and not isinstance(data.get('description'), str):
        errors['description'] = "Description must be a string."

    if 'energy_value' in data and not isinstance(data.get('energy_value'), int):
        errors['energy_value'] = "Energy value must be an integer."

    if 'points_value' in data:
        if not isinstance(data.get('points_value'), int):
            errors['points_value'] = "Points value must be an integer."
        elif data.get('points_value', 0) < 0:
            errors['points_value'] = "Points value cannot be negative."

    start_dt_obj, start_dt_err = None, None
    if 'start_datetime' in data:
        start_dt_obj, start_dt_err = validate_iso_datetime(data.get('start_datetime'))
        if start_dt_err:
            errors['start_datetime'] = start_dt_err

    end_dt_obj, end_dt_err = None, None
    if 'end_datetime' in data:
        end_dt_obj, end_dt_err = validate_iso_datetime(data.get('end_datetime'))
        if end_dt_err:
            errors['end_datetime'] = end_dt_err
    
    if start_dt_obj and end_dt_obj and end_dt_obj <= start_dt_obj:
        errors['end_datetime'] = "End datetime must be after start datetime."

    if 'quest_id' in data and data.get('quest_id') is not None:
        try:
            if data['quest_id']: 
                uuid.UUID(str(data['quest_id']))
        except ValueError:
            errors['quest_id'] = "Invalid Quest ID format."

    if 'status' in data and data.get('status') not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        errors['status'] = "Invalid status. Must be 'PENDING', 'COMPLETED', or 'SKIPPED'."

    if 'tag_ids' in data:
        if not isinstance(data.get('tag_ids'), list):
            errors['tag_ids'] = "tag_ids must be a list."
        else:
            for tag_id_str in data.get('tag_ids', []):
                try:
                    uuid.UUID(str(tag_id_str))
                except ValueError:
                    errors['tag_ids'] = f"Invalid UUID format for tag_id: {tag_id_str}."
                    break
    return errors, start_dt_obj, end_dt_obj

def parse_date_query_param(date_str):
    if not date_str:
        return None
    try:
        # Using datetime.date.fromisoformat for robust YYYY-MM-DD parsing
        return date.fromisoformat(date_str.split('T')[0]) 
    except ValueError:
        return None

# --- CORRECCIÓN AQUÍ ---
# El decorador de ruta DEBE estar inmediatamente encima de la función 'def'
@scheduled_mission_bp.route('', methods=['POST'])
@token_required
def create_scheduled_mission():
    data = request.get_json()
    current_user = g.current_user

    errors, start_datetime_obj, end_datetime_obj = validate_scheduled_mission_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    title = data['title'].strip()
    description = data.get('description', '').strip() if data.get('description') else None
    energy_value = data['energy_value']
    points_value = data['points_value']
    quest_id_str = data.get('quest_id')
    tag_ids_str_list = data.get('tag_ids', [])
    status = data.get('status', 'PENDING')

    assigned_quest_object = None
    final_quest_id_for_db = None

    if quest_id_str:
        try:
            quest_uuid = uuid.UUID(quest_id_str)
            found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
            if not found_quest:
                return jsonify({"error": "Specified Quest not found or access denied."}), 404
            final_quest_id_for_db = found_quest.id
            assigned_quest_object = found_quest
        except ValueError:
            return jsonify({"error": "Invalid Quest ID format provided."}), 400
    else:
        default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not default_quest:
            current_app.logger.error(f"CRITICAL: User {current_user.id} does not have a default Quest.")
            return jsonify({"error": "Default quest not found. Cannot create mission."}), 500
        final_quest_id_for_db = default_quest.id
        assigned_quest_object = default_quest
    
    try:
        new_mission = ScheduledMission(
            user_id=current_user.id,
            title=title,
            description=description,
            energy_value=energy_value,
            points_value=points_value,
            start_datetime=start_datetime_obj,
            end_datetime=end_datetime_obj,
            quest_id=final_quest_id_for_db,
            status=status
        )
        db.session.add(new_mission)
        db.session.flush()

        if tag_ids_str_list:
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    pass 
            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                new_mission.tags = tags_to_associate
        
        db.session.commit()
        
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in new_mission.tags]
        return jsonify({
            "id": str(new_mission.id),
            "title": new_mission.title,
            "description": new_mission.description,
            "energy_value": new_mission.energy_value,
            "points_value": new_mission.points_value,
            "start_datetime": new_mission.start_datetime.isoformat(),
            "end_datetime": new_mission.end_datetime.isoformat(),
            "status": new_mission.status,
            "quest_id": str(new_mission.quest_id) if new_mission.quest_id else None,
            "quest_name": assigned_quest_object.name if assigned_quest_object else None,
            "tags": mission_tags_data,
            "created_at": new_mission.created_at.isoformat(),
            "updated_at": new_mission.updated_at.isoformat()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating scheduled mission for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to create scheduled mission due to an internal error"}), 500


@scheduled_mission_bp.route('', methods=['GET'])
@token_required
def get_scheduled_missions():
    current_user = g.current_user
    quest_id_filter_str = request.args.get('quest_id')
    tag_ids_filter_str = request.args.get('tags')
    status_filter = request.args.get('status')
    filter_start_date_str = request.args.get('filter_start_date')
    filter_end_date_str = request.args.get('filter_end_date')

    try:
        query = ScheduledMission.query.filter_by(user_id=current_user.id)

        if quest_id_filter_str:
            try:
                quest_uuid = uuid.UUID(quest_id_filter_str)
                query = query.filter(ScheduledMission.quest_id == quest_uuid)
            except ValueError:
                current_app.logger.warning(f"Invalid quest_id format for filter: {quest_id_filter_str}")
        
        if tag_ids_filter_str:
            tag_ids_list_str = [tid.strip() for tid in tag_ids_filter_str.split(',') if tid.strip()]
            if tag_ids_list_str:
                try:
                    tag_uuids = [uuid.UUID(tid) for tid in tag_ids_list_str]
                    query = query.filter(ScheduledMission.tags.any(Tag.id.in_(tag_uuids)))
                except ValueError:
                    current_app.logger.warning(f"Invalid tag_id format in tags filter: {tag_ids_filter_str}")

        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED', 'SKIPPED']:
            query = query.filter(ScheduledMission.status == status_filter.upper())

        filter_start_date_obj = parse_date_query_param(filter_start_date_str)
        filter_end_date_obj = parse_date_query_param(filter_end_date_str)

        if filter_start_date_obj:
            query = query.filter(ScheduledMission.end_datetime >= datetime.combine(filter_start_date_obj, datetime.min.time(), tzinfo=timezone.utc))
        if filter_end_date_obj:
            query = query.filter(ScheduledMission.start_datetime <= datetime.combine(filter_end_date_obj, datetime.max.time(), tzinfo=timezone.utc))

        missions = query.order_by(ScheduledMission.start_datetime.asc()).all()
        
        missions_data = []
        for mission in missions:
            quest_name_val = None
            if mission.quest_id: 
                quest_obj = Quest.query.get(mission.quest_id)
                if quest_obj:
                    quest_name_val = quest_obj.name
            
            mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]
            missions_data.append({
                "id": str(mission.id),
                "title": mission.title,
                "description": mission.description,
                "energy_value": mission.energy_value,
                "points_value": mission.points_value,
                "start_datetime": mission.start_datetime.isoformat(),
                "end_datetime": mission.end_datetime.isoformat(),
                "status": mission.status,
                "quest_id": str(mission.quest_id) if mission.quest_id else None,
                "quest_name": quest_name_val,
                "tags": mission_tags_data,
                "created_at": mission.created_at.isoformat(),
                "updated_at": mission.updated_at.isoformat()
            })
        return jsonify(missions_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching scheduled missions for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch scheduled missions"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['GET'])
@token_required
def get_scheduled_mission(mission_id):
    current_user = g.current_user
    try:
        mission = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404
        
        quest_name_val = Quest.query.get(mission.quest_id).name if mission.quest_id else None
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]
        return jsonify({
            "id": str(mission.id),
            "title": mission.title,
            "description": mission.description,
            "energy_value": mission.energy_value,
            "points_value": mission.points_value,
            "start_datetime": mission.start_datetime.isoformat(),
            "end_datetime": mission.end_datetime.isoformat(),
            "status": mission.status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": quest_name_val,
            "tags": mission_tags_data,
            "created_at": mission.created_at.isoformat(),
            "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch scheduled mission"}), 500


@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['PUT'])
@token_required
def update_scheduled_mission(mission_id):
    data = request.get_json()
    current_user = g.current_user

    mission_to_update = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
    if not mission_to_update:
        return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

    errors, start_datetime_obj, end_datetime_obj = validate_scheduled_mission_data(data, is_update=True)
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        if 'title' in data: mission_to_update.title = data['title'].strip()
        if 'description' in data: mission_to_update.description = data['description'].strip() if data.get('description') else None
        if 'energy_value' in data: mission_to_update.energy_value = data['energy_value']
        if 'points_value' in data: mission_to_update.points_value = data['points_value']
        if start_datetime_obj: mission_to_update.start_datetime = start_datetime_obj
        if end_datetime_obj: mission_to_update.end_datetime = end_datetime_obj
        
        if mission_to_update.end_datetime <= mission_to_update.start_datetime:
             return jsonify({"errors": {"end_datetime": "End datetime must be after start datetime after update."}}), 400

        if 'status' in data and data['status'] in ['PENDING', 'COMPLETED', 'SKIPPED']:
            old_status = mission_to_update.status
            new_status = data['status']
            mission_to_update.status = new_status
            if new_status == 'COMPLETED' and old_status != 'COMPLETED':
                current_app.logger.info(f"ScheduledMission {mission_id} completed. Logging energy/points (placeholder).")
                energy_log_entry = EnergyLog(
                    user_id=current_user.id,
                    source_entity_type='SCHEDULED_MISSION',
                    source_entity_id=mission_to_update.id,
                    energy_value=mission_to_update.energy_value,
                    reason_text=f"Completed Scheduled Mission: {mission_to_update.title}"
                )
                db.session.add(energy_log_entry)
        
        final_assigned_quest_object = Quest.query.get(mission_to_update.quest_id) if mission_to_update.quest_id else None

        if 'quest_id' in data:
            quest_id_str = data.get('quest_id')
            if quest_id_str:
                quest_uuid_to_assign = uuid.UUID(quest_id_str)
                quest_to_assign = Quest.query.filter_by(id=quest_uuid_to_assign, user_id=current_user.id).first()
                if not quest_to_assign:
                    return jsonify({"error": "Specified Quest not found for update."}), 404
                mission_to_update.quest_id = quest_to_assign.id
                final_assigned_quest_object = quest_to_assign
            else: 
                default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
                if not default_quest: return jsonify({"error": "Default quest not found."}), 500
                mission_to_update.quest_id = default_quest.id
                final_assigned_quest_object = default_quest
        
        if 'tag_ids' in data:
            tag_ids_str_list = data.get('tag_ids', [])
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError: pass
            
            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                mission_to_update.tags = tags_to_associate
            else:
                mission_to_update.tags = []

        db.session.commit()
        
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission_to_update.tags]
        return jsonify({
            "id": str(mission_to_update.id),
            "title": mission_to_update.title,
            "description": mission_to_update.description,
            "energy_value": mission_to_update.energy_value,
            "points_value": mission_to_update.points_value,
            "start_datetime": mission_to_update.start_datetime.isoformat(),
            "end_datetime": mission_to_update.end_datetime.isoformat(),
            "status": mission_to_update.status,
            "quest_id": str(mission_to_update.quest_id) if mission_to_update.quest_id else None,
            "quest_name": final_assigned_quest_object.name if final_assigned_quest_object else None,
            "tags": mission_tags_data,
            "updated_at": mission_to_update.updated_at.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update scheduled mission"}), 500


@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['DELETE'])
@token_required
def delete_scheduled_mission(mission_id):
    current_user = g.current_user
    try:
        mission_to_delete = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission_to_delete:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

        mission_to_delete.tags = [] 
        db.session.flush()
        
        mission_title_deleted = mission_to_delete.title
        db.session.delete(mission_to_delete)
        db.session.commit()
        
        return jsonify({"message": f"Scheduled Mission '{mission_title_deleted}' deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete scheduled mission"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>/status', methods=['PATCH'])
@token_required
def update_scheduled_mission_status(mission_id):
    data = request.get_json()
    current_user = g.current_user
    new_status = data.get('status')

    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid or missing status. Must be 'PENDING', 'COMPLETED', or 'SKIPPED'."}), 400

    try:
        mission = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

        old_status = mission.status
        mission.status = new_status.upper()
        
        if mission.status == 'COMPLETED' and old_status != 'COMPLETED':
            current_app.logger.info(f"ScheduledMission {mission_id} PATCH completed. Logging energy/points (placeholder).")
            energy_log_entry = EnergyLog(
                user_id=current_user.id,
                source_entity_type='SCHEDULED_MISSION', 
                source_entity_id=mission.id,
                energy_value=mission.energy_value, 
                reason_text=f"Completed Scheduled Mission: {mission.title}"
            )
            db.session.add(energy_log_entry)

        db.session.commit()

        quest_name_val = Quest.query.get(mission.quest_id).name if mission.quest_id else None
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]

        return jsonify({
            "id": str(mission.id),
            "title": mission.title,
            "description": mission.description,
            "energy_value": mission.energy_value,
            "points_value": mission.points_value,
            "start_datetime": mission.start_datetime.isoformat(),
            "end_datetime": mission.end_datetime.isoformat(),
            "status": mission.status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": quest_name_val,
            "tags": mission_tags_data,
            "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating status for scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update mission status"}), 500