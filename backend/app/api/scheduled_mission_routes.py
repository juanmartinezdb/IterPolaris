# backend/app/api/scheduled_mission_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, ScheduledMission, EnergyLog 
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date, time # time importado
from app.services.gamification_services import update_user_stats_after_mission

scheduled_mission_bp = Blueprint('scheduled_mission_bp', __name__, url_prefix='/api/scheduled-missions')

def parse_datetime_from_iso_or_date_str(dt_str, is_end_of_day=False):
    """
    Parses a datetime string. If only date is provided, sets time component.
    Returns a timezone-aware UTC datetime object or (None, error_message).
    """
    if not dt_str:
        return None, "Datetime string cannot be empty."
    try:
        if 'T' in dt_str: # Full datetime string
            if dt_str.endswith('Z'):
                dt_obj = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            elif '+' in dt_str[10:] or '-' in dt_str[10:]:
                dt_obj = datetime.fromisoformat(dt_str)
            else: # Naive datetime string
                dt_obj = datetime.fromisoformat(dt_str)
                if dt_obj.tzinfo is None:
                    dt_obj = dt_obj.replace(tzinfo=timezone.utc)
        else: # Only date string (YYYY-MM-DD)
            date_obj = date.fromisoformat(dt_str)
            if is_end_of_day:
                # For end_datetime of an all-day event, set to very end of the day
                dt_obj = datetime.combine(date_obj, time.max, tzinfo=timezone.utc)
            else:
                # For start_datetime of an all-day event, set to beginning of the day
                dt_obj = datetime.combine(date_obj, time.min, tzinfo=timezone.utc)
        
        return dt_obj.astimezone(timezone.utc), None
    except ValueError as e:
        return None, f"Invalid ISO 8601 datetime/date format: {e}"
    except Exception as e:
        return None, f"Error parsing datetime/date: {e}"


def validate_scheduled_mission_data(data, is_update=False):
    errors = {}
    required_fields_on_create = ['title', 'energy_value', 'points_value', 'start_datetime']
    # end_datetime is only required if not is_all_day or if start_datetime is present

    if not is_update:
        for field in required_fields_on_create:
            if data.get(field) is None: 
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

    is_all_day_event = data.get('is_all_day', False)
    if 'is_all_day' in data and not isinstance(is_all_day_event, bool):
        errors['is_all_day'] = "is_all_day must be a boolean."

    start_dt_obj, start_dt_err = None, None
    if 'start_datetime' in data and data.get('start_datetime') is not None:
        start_dt_obj, start_dt_err = parse_datetime_from_iso_or_date_str(data.get('start_datetime'))
        if start_dt_err:
            errors['start_datetime'] = start_dt_err
    elif not is_update: # Required on create
         errors['start_datetime'] = "start_datetime is required."


    end_dt_obj, end_dt_err = None, None
    if not is_all_day_event : # end_datetime is required if not an all-day event
        if 'end_datetime' in data and data.get('end_datetime') is not None:
            end_dt_obj, end_dt_err = parse_datetime_from_iso_or_date_str(data.get('end_datetime'))
            if end_dt_err:
                errors['end_datetime'] = end_dt_err
        elif not is_update: # Required on create if not all_day
             errors['end_datetime'] = "end_datetime is required for non-all-day events."
    
    if start_dt_obj and not is_all_day_event and end_dt_obj and end_dt_obj <= start_dt_obj:
        errors['end_datetime'] = "End datetime must be after start datetime for timed events."
    
    # If it's an all-day event, and start_dt_obj is valid, end_dt_obj will be derived
    if is_all_day_event and start_dt_obj:
        end_dt_obj = datetime.combine(start_dt_obj.date(), time.max, tzinfo=timezone.utc)


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
                try: uuid.UUID(str(tag_id_str))
                except ValueError: errors['tag_ids'] = f"Invalid UUID format for tag_id: {tag_id_str}."; break
    
    return errors, start_dt_obj, end_dt_obj


def parse_date_query_param(date_str):
    if not date_str: return None
    try: return date.fromisoformat(date_str.split('T')[0]) 
    except ValueError: return None


@scheduled_mission_bp.route('', methods=['POST'])
@token_required
def create_scheduled_mission():
    data = request.get_json()
    current_user = g.current_user

    errors, start_datetime_obj, end_datetime_obj_from_validation = validate_scheduled_mission_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    is_all_day_event = data.get('is_all_day', False)
    
    # Final datetime objects determination
    final_start_datetime = start_datetime_obj
    final_end_datetime = None

    if is_all_day_event:
        if final_start_datetime: # start_datetime is the reference date
            # For all-day, set start to beginning of day, end to end of day
            date_part = final_start_datetime.date()
            final_start_datetime = datetime.combine(date_part, time.min, tzinfo=timezone.utc)
            final_end_datetime = datetime.combine(date_part, time.max, tzinfo=timezone.utc)
        else: # Should not happen if validation passes
            return jsonify({"errors": {"start_datetime": "Start date is required for all-day events."}}), 400
    else: # Not an all-day event
        final_end_datetime = end_datetime_obj_from_validation # Use validated end_datetime
        if not final_end_datetime: # Ensure end_datetime is present if not all-day
             return jsonify({"errors": {"end_datetime": "End datetime is required for non-all-day events."}}), 400

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
            if not found_quest: return jsonify({"error": "Specified Quest not found or access denied."}), 404
            final_quest_id_for_db = found_quest.id; assigned_quest_object = found_quest
        except ValueError: return jsonify({"error": "Invalid Quest ID format provided."}), 400
    else: 
        default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not default_quest:
            current_app.logger.error(f"CRITICAL: User {current_user.id} does not have a default Quest for SM assignment.")
            return jsonify({"error": "Default quest not found. Cannot create mission."}), 500
        final_quest_id_for_db = default_quest.id; assigned_quest_object = default_quest
    
    try:
        new_mission = ScheduledMission(
            user_id=current_user.id, title=title, description=description,
            energy_value=energy_value, points_value=points_value,
            start_datetime=final_start_datetime, end_datetime=final_end_datetime,
            is_all_day=is_all_day_event, # Set the new field
            quest_id=final_quest_id_for_db, status=status
        )
        db.session.add(new_mission); db.session.flush() 

        if tag_ids_str_list:
            valid_tag_uuids = [uuid.UUID(tid) for tid in tag_ids_str_list if tid]
            tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
            new_mission.tags = tags_to_associate
        
        db.session.commit()
        
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in new_mission.tags]
        return jsonify({
            "id": str(new_mission.id), "title": new_mission.title, "description": new_mission.description,
            "energy_value": new_mission.energy_value, "points_value": new_mission.points_value,
            "start_datetime": new_mission.start_datetime.isoformat(),
            "end_datetime": new_mission.end_datetime.isoformat(),
            "is_all_day": new_mission.is_all_day, # Return new field
            "status": new_mission.status,
            "quest_id": str(new_mission.quest_id) if new_mission.quest_id else None,
            "quest_name": assigned_quest_object.name if assigned_quest_object else None,
            "tags": mission_tags_data,
            "created_at": new_mission.created_at.isoformat(), "updated_at": new_mission.updated_at.isoformat()
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
    tag_ids_param = request.args.getlist('tags') 
    status_filter = request.args.get('status')
    filter_start_date_str = request.args.get('filter_start_date')
    filter_end_date_str = request.args.get('filter_end_date')
    # New filter for all_day
    all_day_filter_str = request.args.get('all_day')


    try:
        query = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                   .filter_by(user_id=current_user.id)

        if quest_id_filter_str:
            try: query = query.filter(ScheduledMission.quest_id == uuid.UUID(quest_id_filter_str))
            except ValueError: current_app.logger.warning(f"Invalid quest_id format: {quest_id_filter_str}")
        
        if tag_ids_param:
            valid_tag_uuids = [uuid.UUID(tid) for tid_str in tag_ids_param for tid in tid_str.split(',') if tid] # Handles CSV and multiple params
            if valid_tag_uuids:
                for tag_uuid_item in valid_tag_uuids: query = query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))

        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED', 'SKIPPED']:
            query = query.filter(ScheduledMission.status == status_filter.upper())

        if all_day_filter_str is not None:
            is_all_day_query = all_day_filter_str.lower() == 'true'
            query = query.filter(ScheduledMission.is_all_day == is_all_day_query)
            
        filter_start_date_obj = parse_date_query_param(filter_start_date_str)
        filter_end_date_obj = parse_date_query_param(filter_end_date_str)

        if filter_start_date_obj:
            query = query.filter(ScheduledMission.end_datetime >= datetime.combine(filter_start_date_obj, time.min, tzinfo=timezone.utc))
        if filter_end_date_obj:
            query = query.filter(ScheduledMission.start_datetime <= datetime.combine(filter_end_date_obj, time.max, tzinfo=timezone.utc))

        missions = query.order_by(ScheduledMission.start_datetime.asc()).all()
        
        missions_data = [{
            "id": str(m.id), "title": m.title, "description": m.description,
            "energy_value": m.energy_value, "points_value": m.points_value,
            "start_datetime": m.start_datetime.isoformat(), "end_datetime": m.end_datetime.isoformat(),
            "is_all_day": m.is_all_day, # Include new field
            "status": m.status, "quest_id": str(m.quest_id) if m.quest_id else None,
            "quest_name": m.quest.name if m.quest else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in m.tags],
            "created_at": m.created_at.isoformat(), "updated_at": m.updated_at.isoformat()
        } for m in missions]
        return jsonify(missions_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching scheduled missions for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch scheduled missions"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['GET'])
@token_required
def get_scheduled_mission(mission_id):
    current_user = g.current_user
    try:
        mission = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                    .filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission: return jsonify({"error": "Scheduled Mission not found or access denied"}), 404
        
        return jsonify({
            "id": str(mission.id), "title": mission.title, "description": mission.description,
            "energy_value": mission.energy_value, "points_value": mission.points_value,
            "start_datetime": mission.start_datetime.isoformat(), "end_datetime": mission.end_datetime.isoformat(),
            "is_all_day": mission.is_all_day, # Include new field
            "status": mission.status, "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": mission.quest.name if mission.quest else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in mission.tags],
            "created_at": mission.created_at.isoformat(), "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching SM {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch scheduled mission"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['PUT'])
@token_required
def update_scheduled_mission(mission_id):
    data = request.get_json()
    current_user = g.current_user

    mission_to_update = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
    if not mission_to_update: return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

    errors, start_datetime_obj, end_datetime_obj_from_validation = validate_scheduled_mission_data(data, is_update=True)
    if errors: return jsonify({"errors": errors}), 400

    try:
        old_status = mission_to_update.status
        original_mission_energy = mission_to_update.energy_value
        original_mission_points = mission_to_update.points_value
        
        is_all_day_event = data.get('is_all_day', mission_to_update.is_all_day) # Default to current if not provided
        mission_to_update.is_all_day = is_all_day_event

        if start_datetime_obj:
            mission_to_update.start_datetime = start_datetime_obj
        if is_all_day_event and mission_to_update.start_datetime:
            # For all-day, set start to BoD, end to EoD
            date_part = mission_to_update.start_datetime.date()
            mission_to_update.start_datetime = datetime.combine(date_part, time.min, tzinfo=timezone.utc)
            mission_to_update.end_datetime = datetime.combine(date_part, time.max, tzinfo=timezone.utc)
        elif end_datetime_obj_from_validation: # Only use if not all-day
            mission_to_update.end_datetime = end_datetime_obj_from_validation
        
        if not is_all_day_event and mission_to_update.end_datetime <= mission_to_update.start_datetime:
            return jsonify({"errors": {"end_datetime": "End datetime must be after start datetime."}}), 400
        
        if 'title' in data: mission_to_update.title = data['title'].strip()
        if 'description' in data: mission_to_update.description = data['description'].strip() if data.get('description') else None
        if 'energy_value' in data: mission_to_update.energy_value = data['energy_value']
        if 'points_value' in data: mission_to_update.points_value = data['points_value']
        
        final_assigned_quest_object = mission_to_update.quest
        if 'quest_id' in data:
            quest_id_str = data.get('quest_id');
            if quest_id_str: 
                quest_uuid = uuid.UUID(quest_id_str); found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
                if not found_quest: return jsonify({"error": "Specified Quest not found."}), 404
                mission_to_update.quest_id = found_quest.id; final_assigned_quest_object = found_quest
            else: 
                default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
                if not default_quest: return jsonify({"error": "Default quest not found."}), 500
                mission_to_update.quest_id = default_quest.id; final_assigned_quest_object = default_quest
        
        if 'tag_ids' in data:
            valid_tags = Tag.query.filter(Tag.id.in_([uuid.UUID(tid) for tid in data.get('tag_ids', []) if tid]), Tag.user_id == current_user.id).all()
            mission_to_update.tags = valid_tags

        if 'status' in data:
            new_status = data['status']
            if new_status != old_status and new_status in ['PENDING', 'COMPLETED', 'SKIPPED']:
                mission_to_update.status = new_status
                points_change = 0; log_reason = None; is_completion_event = False
                if new_status == 'COMPLETED':
                    points_change = original_mission_points; log_reason = f"Completed SM: {mission_to_update.title}"; is_completion_event = True
                elif old_status == 'COMPLETED':
                    points_change = -original_mission_points; log_reason = f"Reverted SM: {mission_to_update.title}"; is_completion_event = False
                if log_reason:
                    update_user_stats_after_mission(current_user, points_change, original_mission_energy, 'SCHEDULED_MISSION', mission_to_update.id, log_reason, is_completion_event)
        
        db.session.commit()
        return jsonify({
            "id": str(mission_to_update.id), "title": mission_to_update.title, "description": mission_to_update.description,
            "energy_value": mission_to_update.energy_value, "points_value": mission_to_update.points_value,
            "start_datetime": mission_to_update.start_datetime.isoformat(), "end_datetime": mission_to_update.end_datetime.isoformat(),
            "is_all_day": mission_to_update.is_all_day, # Return new field
            "status": mission_to_update.status,
            "quest_id": str(mission_to_update.quest_id) if mission_to_update.quest_id else None,
            "quest_name": final_assigned_quest_object.name if final_assigned_quest_object else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in mission_to_update.tags],
            "user_total_points": current_user.total_points, "user_level": current_user.level,
            "updated_at": mission_to_update.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating SM {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update scheduled mission"}), 500

# PATCH /status and DELETE endpoints remain largely the same but should also return is_all_day
@scheduled_mission_bp.route('/<uuid:mission_id>/status', methods=['PATCH'])
@token_required
def update_scheduled_mission_status(mission_id):
    data = request.get_json(); current_user = g.current_user; new_status = data.get('status')
    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid status."}), 400
    try:
        mission = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                   .filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission: return jsonify({"error": "SM not found."}), 404
        old_status = mission.status
        if old_status == new_status.upper(): # No change
             return jsonify({ # Return full data for consistency
                "id": str(mission.id), "title": mission.title, "description": mission.description,
                "energy_value": mission.energy_value, "points_value": mission.points_value,
                "start_datetime": mission.start_datetime.isoformat(), "end_datetime": mission.end_datetime.isoformat(),
                "is_all_day": mission.is_all_day, "status": mission.status,
                "quest_id": str(mission.quest_id) if mission.quest_id else None,
                "quest_name": mission.quest.name if mission.quest else None,
                "tags": [{"id": str(t.id), "name": t.name} for t in mission.tags],
                "user_total_points": current_user.total_points, "user_level": current_user.level,
                "updated_at": mission.updated_at.isoformat()
            }), 200

        mission.status = new_status.upper()
        points_change = 0; log_reason = None; is_completion_event = False
        if mission.status == 'COMPLETED':
            points_change = mission.points_value; log_reason = f"Completed SM: {mission.title}"; is_completion_event = True
        elif old_status == 'COMPLETED':
            points_change = -mission.points_value; log_reason = f"Reverted SM: {mission.title}"; is_completion_event = False
        if log_reason:
            update_user_stats_after_mission(current_user, points_change, mission.energy_value, 'SCHEDULED_MISSION', mission.id, log_reason, is_completion_event)
        db.session.commit()
        return jsonify({
            "id": str(mission.id), "title": mission.title, "description": mission.description,
            "energy_value": mission.energy_value, "points_value": mission.points_value,
            "start_datetime": mission.start_datetime.isoformat(), "end_datetime": mission.end_datetime.isoformat(),
            "is_all_day": mission.is_all_day, "status": mission.status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": mission.quest.name if mission.quest else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in mission.tags],
            "user_total_points": current_user.total_points, "user_level": current_user.level,
            "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error updating SM status {mission_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update mission status"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['DELETE'])
@token_required
def delete_scheduled_mission(mission_id):
    current_user = g.current_user
    try:
        mission = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission: return jsonify({"error": "SM not found."}), 404
        if mission.status == 'COMPLETED':
             update_user_stats_after_mission(current_user, -mission.points_value, mission.energy_value, 'SCHEDULED_MISSION', mission.id, f"Deleted completed SM: {mission.title}", False)
        mission.tags = [] # type: ignore 
        db.session.flush() 
        title_deleted = mission.title; db.session.delete(mission); db.session.commit()
        return jsonify({"message": f"SM '{title_deleted}' deleted.", "user_total_points": current_user.total_points, "user_level": current_user.level}), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error deleting SM {mission_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete scheduled mission"}), 500