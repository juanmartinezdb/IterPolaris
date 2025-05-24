# backend/app/api/habit_template_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, HabitTemplate, HabitOccurrence 
from app.auth_utils import token_required
import uuid
from datetime import date, time, datetime, timezone 
from app.services.habit_services import generate_occurrences_for_template 

habit_template_bp = Blueprint('habit_template_bp', __name__, url_prefix='/api/habit-templates')

# --- Funciones auxiliares de validación y parseo (sin cambios) ---
def parse_iso_date(date_str):
    if not date_str: return None
    try: return date.fromisoformat(date_str)
    except ValueError: return None

def parse_iso_time(time_str):
    if not time_str: return None
    try:
        if len(time_str) == 8 and time_str.count(':') == 2: return time.fromisoformat(time_str)
        elif len(time_str) == 5 and time_str.count(':') == 1: return time.fromisoformat(time_str + ':00')
        raise ValueError("Time format must be HH:MM or HH:MM:SS")
    except ValueError: return None

def validate_habit_template_data(data, is_update=False):
    errors = {}
    required_fields_create = ['title', 'default_energy_value', 'default_points_value', 'rec_pattern_start_date']
    if not is_update:
        for field in required_fields_create:
            if data.get(field) is None and field not in ['rec_by_day', 'rec_start_time', 'rec_duration_minutes', 'rec_ends_on_date']: # rec_ends_on_date es opcional
                errors[field] = f"{field} is required."
    
    if 'title' in data and (not isinstance(data.get('title'), str) or not data.get('title', '').strip()):
        errors['title'] = "Title must be a non-empty string."
    elif 'title' in data and len(data.get('title', '')) > 255: errors['title'] = "Title is too long (max 255 characters)."
    if 'description' in data and data.get('description') is not None and not isinstance(data.get('description'), str): errors['description'] = "Description must be a string."
    if 'default_energy_value' in data and not isinstance(data.get('default_energy_value'), int): errors['default_energy_value'] = "Default energy value must be an integer."
    if 'default_points_value' in data:
        if not isinstance(data.get('default_points_value'), int): errors['default_points_value'] = "Default points value must be an integer."
        elif data.get('default_points_value', 0) < 0: errors['default_points_value'] = "Default points value cannot be negative."
    if 'rec_by_day' in data and data.get('rec_by_day') is not None:
        if not isinstance(data.get('rec_by_day'), list): errors['rec_by_day'] = "rec_by_day must be a list."
        else:
            valid_days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'DAILY', 'WEEKLY']; invalid_days = [d for d in data.get('rec_by_day') if not isinstance(d, str) or d.upper() not in valid_days]
            if invalid_days: errors['rec_by_day'] = f"Invalid values in rec_by_day: {', '.join(invalid_days)}. Allowed: {valid_days}"
            elif not data.get('rec_by_day'): errors['rec_by_day'] = "rec_by_day cannot be empty if provided; select days or 'DAILY'/'WEEKLY'." # PRD no fuerza a tenerlo, pero si se provee, que no sea vacío.
    
    rec_pattern_start_date_obj = None
    if 'rec_pattern_start_date' in data and data.get('rec_pattern_start_date') is not None:
        rec_pattern_start_date_obj = parse_iso_date(data.get('rec_pattern_start_date'))
        if not rec_pattern_start_date_obj: errors['rec_pattern_start_date'] = "Invalid rec_pattern_start_date format. Use YYYY-MM-DD."
    elif not is_update and 'rec_pattern_start_date' not in data: errors['rec_pattern_start_date'] = "rec_pattern_start_date is required."
    
    rec_ends_on_date_obj = None
    if 'rec_ends_on_date' in data and data.get('rec_ends_on_date') is not None and data.get('rec_ends_on_date') != '': # Permitir string vacío para borrar
        rec_ends_on_date_obj = parse_iso_date(data.get('rec_ends_on_date'))
        if not rec_ends_on_date_obj: errors['rec_ends_on_date'] = "Invalid rec_ends_on_date format. Use YYYY-MM-DD."
        elif rec_pattern_start_date_obj and rec_ends_on_date_obj < rec_pattern_start_date_obj: errors['rec_ends_on_date'] = "rec_ends_on_date cannot be before rec_pattern_start_date."
    
    rec_start_time_obj = None
    if 'rec_start_time' in data and data.get('rec_start_time') is not None and data.get('rec_start_time') != '': # Permitir string vacío para borrar
        rec_start_time_obj = parse_iso_time(data.get('rec_start_time'))
        if not rec_start_time_obj: errors['rec_start_time'] = "Invalid rec_start_time format. Use HH:MM or HH:MM:SS."
    
    if 'rec_duration_minutes' in data and data.get('rec_duration_minutes') is not None:
        try:
            duration = int(data.get('rec_duration_minutes'))
            if duration <= 0: errors['rec_duration_minutes'] = "rec_duration_minutes must be a positive integer if provided."
        except (ValueError, TypeError): errors['rec_duration_minutes'] = "rec_duration_minutes must be a positive integer if provided."
    
    if 'is_active' in data and not isinstance(data.get('is_active'), bool): errors['is_active'] = "is_active must be a boolean."
    if 'quest_id' in data and data.get('quest_id') is not None:
        try:
            if data['quest_id']: uuid.UUID(str(data['quest_id']))
        except ValueError: errors['quest_id'] = "Invalid Quest ID format."
    if 'tag_ids' in data:
        if not isinstance(data.get('tag_ids'), list): errors['tag_ids'] = "tag_ids must be a list."
        else:
            for tag_id_str in data.get('tag_ids', []):
                try: uuid.UUID(str(tag_id_str))
                except ValueError: errors['tag_ids'] = f"Invalid UUID format for tag_id: {tag_id_str}."; break
    return errors, rec_pattern_start_date_obj, rec_ends_on_date_obj, rec_start_time_obj
# --- Fin Funciones auxiliares ---

@habit_template_bp.route('', methods=['POST'])
@token_required
def create_habit_template():
    data = request.get_json()
    current_user = g.current_user
    errors, start_date_obj, end_date_obj, start_time_obj = validate_habit_template_data(data)
    if errors: return jsonify({"errors": errors}), 400

    quest_id_str = data.get('quest_id'); final_quest_id = None; assigned_quest_object_name = None
    if quest_id_str:
        try:
            quest_uuid = uuid.UUID(quest_id_str)
            found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
            if not found_quest: return jsonify({"error": "Specified Quest not found."}), 404
            final_quest_id = found_quest.id; assigned_quest_object_name = found_quest.name
        except ValueError: return jsonify({"error": "Invalid Quest ID format."}), 400
    else:
        default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not default_quest: return jsonify({"error": "Default quest not found."}), 500
        final_quest_id = default_quest.id; assigned_quest_object_name = default_quest.name
    try:
        new_template = HabitTemplate(
            user_id=current_user.id, title=data['title'].strip(),
            description=data.get('description', '').strip() or None,
            default_energy_value=data['default_energy_value'], default_points_value=data['default_points_value'],
            rec_by_day=data.get('rec_by_day') or [], # Asegurar que sea una lista
            rec_start_time=start_time_obj, 
            rec_duration_minutes=int(data.get('rec_duration_minutes')) if data.get('rec_duration_minutes') is not None else None,
            rec_pattern_start_date=start_date_obj, rec_ends_on_date=end_date_obj,
            is_active=data.get('is_active', True), quest_id=final_quest_id
        )
        db.session.add(new_template); db.session.flush()
        tag_ids_str_list = data.get('tag_ids', [])
        if tag_ids_str_list:
            valid_tags = Tag.query.filter(Tag.id.in_([uuid.UUID(tid) for tid in tag_ids_str_list if tid]), Tag.user_id == current_user.id).all()
            new_template.tags = valid_tags
        db.session.commit()
        if new_template.is_active: generate_occurrences_for_template(new_template)
        return jsonify({
            "id": str(new_template.id), "title": new_template.title, "description": new_template.description,
            "default_energy_value": new_template.default_energy_value, "default_points_value": new_template.default_points_value,
            "rec_by_day": new_template.rec_by_day,
            "rec_start_time": new_template.rec_start_time.isoformat()[:5] if new_template.rec_start_time else None,
            "rec_duration_minutes": new_template.rec_duration_minutes,
            "rec_pattern_start_date": new_template.rec_pattern_start_date.isoformat(),
            "rec_ends_on_date": new_template.rec_ends_on_date.isoformat() if new_template.rec_ends_on_date else None,
            "is_active": new_template.is_active, "quest_id": str(new_template.quest_id) if new_template.quest_id else None,
            "quest_name": assigned_quest_object_name, "tags": [{"id": str(t.id), "name": t.name} for t in new_template.tags],
            "created_at": new_template.created_at.isoformat(), "updated_at": new_template.updated_at.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"HT Create Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create habit template"}), 500

@habit_template_bp.route('', methods=['GET'])
@token_required
def get_habit_templates():
    current_user = g.current_user
    tag_ids_param = request.args.getlist('tags') # Para filtro por tags

    try:
        query = HabitTemplate.query.options(
            db.joinedload(HabitTemplate.quest), 
            db.selectinload(HabitTemplate.tags)
        ).filter_by(user_id=current_user.id)

        if tag_ids_param:
            valid_tag_uuids = []
            for tid_str in tag_ids_param:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    current_app.logger.warning(f"Invalid tag_id format in tags filter for habit templates: {tid_str}")
            
            if valid_tag_uuids:
                # Filtrar plantillas que tienen TODOS los tags provistos
                for tag_uuid_item in valid_tag_uuids:
                    query = query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))
        
        templates = query.order_by(HabitTemplate.is_active.desc(), HabitTemplate.title).all() # Activas primero
        
        templates_data = [{
            "id": str(ht.id), "title": ht.title, "description": ht.description,
            "default_energy_value": ht.default_energy_value, "default_points_value": ht.default_points_value,
            "rec_by_day": ht.rec_by_day,
            "rec_start_time": ht.rec_start_time.isoformat()[:5] if ht.rec_start_time else None,
            "rec_duration_minutes": ht.rec_duration_minutes,
            "rec_pattern_start_date": ht.rec_pattern_start_date.isoformat(),
            "rec_ends_on_date": ht.rec_ends_on_date.isoformat() if ht.rec_ends_on_date else None,
            "is_active": ht.is_active, "quest_id": str(ht.quest_id) if ht.quest_id else None,
            "quest_name": ht.quest.name if ht.quest else None, 
            "tags": [{"id": str(t.id), "name": t.name} for t in ht.tags],
            "created_at": ht.created_at.isoformat(), "updated_at": ht.updated_at.isoformat()
        } for ht in templates]
        return jsonify(templates_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching habit templates: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch habit templates"}), 500

@habit_template_bp.route('/<uuid:template_id>', methods=['GET'])
@token_required
def get_habit_template(template_id):
    current_user = g.current_user
    template = HabitTemplate.query.options(db.joinedload(HabitTemplate.quest), db.selectinload(HabitTemplate.tags))\
                                 .filter_by(id=template_id, user_id=current_user.id).first()
    if not template: return jsonify({"error": "Habit Template not found"}), 404
    return jsonify({
        "id": str(template.id), "title": template.title, "description": template.description,
        "default_energy_value": template.default_energy_value, "default_points_value": template.default_points_value,
        "rec_by_day": template.rec_by_day,
        "rec_start_time": template.rec_start_time.isoformat()[:5] if template.rec_start_time else None,
        "rec_duration_minutes": template.rec_duration_minutes,
        "rec_pattern_start_date": template.rec_pattern_start_date.isoformat(),
        "rec_ends_on_date": template.rec_ends_on_date.isoformat() if template.rec_ends_on_date else None,
        "is_active": template.is_active, "quest_id": str(template.quest_id) if template.quest_id else None,
        "quest_name": template.quest.name if template.quest else None,
        "tags": [{"id": str(t.id), "name": t.name} for t in template.tags],
        "created_at": template.created_at.isoformat(), "updated_at": template.updated_at.isoformat()
    }), 200

@habit_template_bp.route('/<uuid:template_id>', methods=['PUT'])
@token_required
def update_habit_template(template_id):
    data = request.get_json()
    current_user = g.current_user
    template = HabitTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
    if not template: return jsonify({"error": "Habit Template not found"}), 404

    errors, start_date_obj, end_date_obj, start_time_obj = validate_habit_template_data(data, is_update=True)
    if errors: return jsonify({"errors": errors}), 400
        
    assigned_quest_object_name = template.quest.name if template.quest else None
    try:
        recurrence_fields_changed = False; core_values_changed = False;
        current_rec_by_day_set = set(template.rec_by_day or [])
        new_rec_by_day_set = set(data.get('rec_by_day', template.rec_by_day) or []) # Default to current if not provided

        if 'rec_by_day' in data and current_rec_by_day_set != new_rec_by_day_set: recurrence_fields_changed = True
        if 'rec_start_time' in data and template.rec_start_time != start_time_obj: recurrence_fields_changed = True # start_time_obj puede ser None
        if 'rec_duration_minutes' in data and template.rec_duration_minutes != (int(data['rec_duration_minutes']) if data.get('rec_duration_minutes') is not None else None): recurrence_fields_changed = True
        if start_date_obj and template.rec_pattern_start_date != start_date_obj: recurrence_fields_changed = True
        if 'rec_ends_on_date' in data and template.rec_ends_on_date != end_date_obj: recurrence_fields_changed = True
        
        if 'title' in data and template.title != data['title'].strip(): core_values_changed = True
        new_desc = data.get('description', '').strip() or None
        if 'description' in data and template.description != new_desc: core_values_changed = True
        if 'default_energy_value' in data and template.default_energy_value != data['default_energy_value']: core_values_changed = True
        if 'default_points_value' in data and template.default_points_value != data['default_points_value']: core_values_changed = True

        if 'title' in data: template.title = data['title'].strip()
        if 'description' in data: template.description = new_desc
        if 'default_energy_value' in data: template.default_energy_value = data['default_energy_value']
        if 'default_points_value' in data: template.default_points_value = data['default_points_value']
        if 'rec_by_day' in data: template.rec_by_day = data.get('rec_by_day') or []
        if 'rec_start_time' in data: template.rec_start_time = start_time_obj
        if 'rec_duration_minutes' in data: template.rec_duration_minutes = int(data['rec_duration_minutes']) if data.get('rec_duration_minutes') is not None else None
        if start_date_obj: template.rec_pattern_start_date = start_date_obj
        if 'rec_ends_on_date' in data: template.rec_ends_on_date = end_date_obj
        
        old_is_active = template.is_active
        if 'is_active' in data: template.is_active = data['is_active']

        if 'quest_id' in data:
            quest_id_str = data.get('quest_id'); new_quest_id = None
            if quest_id_str:
                quest_uuid = uuid.UUID(quest_id_str); found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
                if not found_quest: return jsonify({"error": "Specified Quest not found."}), 404
                new_quest_id = found_quest.id; assigned_quest_object_name = found_quest.name
            else:
                default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
                if not default_quest: return jsonify({"error": "Default quest not found."}), 500
                new_quest_id = default_quest.id; assigned_quest_object_name = default_quest.name
            if template.quest_id != new_quest_id: core_values_changed = True; template.quest_id = new_quest_id
        
        if 'tag_ids' in data:
            tag_ids_str_list = data.get('tag_ids', [])
            valid_tags = Tag.query.filter(Tag.id.in_([uuid.UUID(tid) for tid in tag_ids_str_list if tid]), Tag.user_id == current_user.id).all()
            if set(t.id for t in template.tags) != set(t.id for t in valid_tags): template.tags = valid_tags # Opt: core_values_changed = True
        
        db.session.commit() 
        if template.is_active and (recurrence_fields_changed or core_values_changed or (not old_is_active and template.is_active)):
            generate_occurrences_for_template(template, force_regenerate_future=True)
        elif not template.is_active and old_is_active:
            generate_occurrences_for_template(template) # This will delete future pending

        return jsonify({
            "id": str(template.id), "title": template.title, "description": template.description,
            "default_energy_value": template.default_energy_value, "default_points_value": template.default_points_value,
            "rec_by_day": template.rec_by_day,
            "rec_start_time": template.rec_start_time.isoformat()[:5] if template.rec_start_time else None,
            "rec_duration_minutes": template.rec_duration_minutes,
            "rec_pattern_start_date": template.rec_pattern_start_date.isoformat(),
            "rec_ends_on_date": template.rec_ends_on_date.isoformat() if template.rec_ends_on_date else None,
            "is_active": template.is_active, "quest_id": str(template.quest_id) if template.quest_id else None,
            "quest_name": assigned_quest_object_name, "tags": [{"id": str(t.id), "name": t.name} for t in template.tags],
            "updated_at": template.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"HT Update Error {template_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update habit template"}), 500

@habit_template_bp.route('/<uuid:template_id>', methods=['DELETE'])
@token_required
def delete_habit_template(template_id):
    current_user = g.current_user
    template = HabitTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
    if not template: return jsonify({"error": "Habit Template not found"}), 404
    try:
        template_title = template.title; db.session.delete(template); db.session.commit()
        return jsonify({"message": f"Habit Template '{template_title}' deleted."}), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"HT Delete Error {template_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete habit template"}), 500

@habit_template_bp.route('/<uuid:template_id>/generate-occurrences', methods=['POST'])
@token_required
def generate_more_occurrences_endpoint(template_id):
    current_user = g.current_user
    template = HabitTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
    if not template: return jsonify({"error": "Habit Template not found"}), 404
    if not template.is_active: return jsonify({"message": "Habit template is not active."}), 200
    try:
        # PRD: Extend by 30 days from the last occurrence, or from today if no future/start date is in past
        last_occurrence = HabitOccurrence.query.filter_by(habit_template_id=template.id)\
            .order_by(HabitOccurrence.scheduled_start_datetime.desc()).first()
        
        start_generation_from = date.today() # Default to today
        if last_occurrence and last_occurrence.scheduled_start_datetime.date() >= date.today():
            start_generation_from = last_occurrence.scheduled_start_datetime.date() + timedelta(days=1)
        elif template.rec_pattern_start_date > date.today(): # If template starts in future and no occ yet
            start_generation_from = template.rec_pattern_start_date
            
        generated_occurrences = generate_occurrences_for_template(template, start_date_override=start_generation_from, generation_days_limit=30)
        return jsonify({"message": f"{len(generated_occurrences)} new occurrences created for '{template.title}'."}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating more occurrences for template {template_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate more occurrences"}), 500