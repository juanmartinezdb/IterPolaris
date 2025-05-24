# backend/app/api/scheduled_mission_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, ScheduledMission, EnergyLog 
from app.auth_utils import token_required
import uuid
from datetime import datetime, timezone, date
from app.services.gamification_services import update_user_stats_after_mission

scheduled_mission_bp = Blueprint('scheduled_mission_bp', __name__, url_prefix='/api/scheduled-missions')

def validate_iso_datetime(dt_str):
    if not dt_str:
        return None, "Datetime string cannot be empty."
    try:
        # Intenta parsear con la 'Z' si está presente
        if dt_str.endswith('Z'):
            dt_obj = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        # Intenta parsear con offset si está presente (ej. +02:00 o -05:00)
        elif '+' in dt_str[10:] or '-' in dt_str[10:]: # Busca +/- después de la fecha YYYY-MM-DD
            dt_obj = datetime.fromisoformat(dt_str)
        # Si no hay 'Z' ni offset explícito, asume que es un datetime local y necesita ser localizado a UTC
        else: # Asumimos que es un datetime local si no hay 'Z' ni offset
            dt_obj = datetime.fromisoformat(dt_str)
            # Si es naive (sin tzinfo), lo localizamos a UTC, asumiendo que el input es UTC o se desea tratar como tal.
            # Para inputs de datetime-local de HTML, esto es lo que usualmente se quiere.
            if dt_obj.tzinfo is None: # o dt_obj.tzinfo is None or dt_obj.tzinfo.utcoffset(dt_obj) is None
                dt_obj = dt_obj.replace(tzinfo=timezone.utc) # O .astimezone(timezone.utc) si ya tiene una TZ y quieres convertirla

        # Asegurar que el objeto final esté en UTC
        return dt_obj.astimezone(timezone.utc), None
    except ValueError as e:
        return None, f"Invalid ISO 8601 datetime format: {e}"
    except Exception as e: # Captura otras excepciones inesperadas
        return None, f"Error parsing datetime: {e}"

def validate_scheduled_mission_data(data, is_update=False):
    errors = {}
    # Campos requeridos solo en la creación, a menos que la lógica de update lo requiera explícitamente
    required_fields_on_create = ['title', 'energy_value', 'points_value', 'start_datetime', 'end_datetime']

    if not is_update:
        for field in required_fields_on_create:
            if field not in data or data[field] is None: # Permitir 0 para valores numéricos
                if field not in ['energy_value', 'points_value'] or data.get(field) is None: 
                    errors[field] = f"{field} is required."

    # Validaciones comunes para creación y actualización si el campo está presente
    if 'title' in data and (not isinstance(data.get('title'), str) or len(data.get('title', '').strip()) == 0):
        errors['title'] = "Title must be a non-empty string."
    elif 'title' in data and len(data.get('title', '')) > 255: # Max longitud para el título
        errors['title'] = "Title is too long (max 255 characters)."

    if 'description' in data and data.get('description') is not None and not isinstance(data.get('description'), str):
        errors['description'] = "Description must be a string."

    if 'energy_value' in data and not isinstance(data.get('energy_value'), int):
        errors['energy_value'] = "Energy value must be an integer."

    if 'points_value' in data:
        if not isinstance(data.get('points_value'), int):
            errors['points_value'] = "Points value must be an integer."
        elif data.get('points_value', 0) < 0: # Asumiendo que points_value no puede ser negativo
            errors['points_value'] = "Points value cannot be negative."

    start_dt_obj, start_dt_err = None, None
    if 'start_datetime' in data: # Validar siempre si se provee
        start_dt_obj, start_dt_err = validate_iso_datetime(data.get('start_datetime'))
        if start_dt_err:
            errors['start_datetime'] = start_dt_err

    end_dt_obj, end_dt_err = None, None
    if 'end_datetime' in data: # Validar siempre si se provee
        end_dt_obj, end_dt_err = validate_iso_datetime(data.get('end_datetime'))
        if end_dt_err:
            errors['end_datetime'] = end_dt_err
    
    # Validar que end_datetime sea posterior a start_datetime si ambos están presentes y son válidos
    if start_dt_obj and end_dt_obj and end_dt_obj <= start_dt_obj:
        errors['end_datetime'] = "End datetime must be after start datetime."

    if 'quest_id' in data and data.get('quest_id') is not None:
        try:
            if data['quest_id']: # Solo intentar convertir si no es una cadena vacía
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
        # Intenta parsear la fecha, asumiendo formato YYYY-MM-DD.
        # El frontend podría enviar la hora también, así que tomamos solo la parte de la fecha.
        return date.fromisoformat(date_str.split('T')[0]) 
    except ValueError:
        return None


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
    status = data.get('status', 'PENDING') # Default a PENDING en creación

    # Determinar Quest
    assigned_quest_object = None # Para obtener el nombre de la quest para la respuesta
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
             # Esto debería ser capturado por validate_scheduled_mission_data, pero por si acaso.
             return jsonify({"error": "Invalid Quest ID format provided."}), 400
    else: # Si no se provee quest_id, asignar a la default del usuario
        default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not default_quest:
            # Este es un caso crítico, un usuario siempre debería tener una quest default.
            current_app.logger.error(f"CRITICAL: User {current_user.id} does not have a default Quest for ScheduledMission assignment.")
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
        db.session.flush() # Para obtener el ID de new_mission si es necesario para relaciones inmediatas

        # Asociar Tags
        if tag_ids_str_list:
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    # Podrías loguear esto o simplemente ignorar tags inválidos
                    current_app.logger.warning(f"Invalid UUID format for tag_id '{tid_str}' during ScheduledMission creation for user {current_user.id}.")
                    pass # Ignorar tag_id inválido

            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                new_mission.tags = tags_to_associate
            else:
                new_mission.tags = [] # Asegurar que esté vacío si no hay tags válidos
        
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
            "quest_name": assigned_quest_object.name if assigned_quest_object else None, # Nombre de la quest
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
    tag_ids_param = request.args.getlist('tags') # Para manejar múltiples 'tags' query params
    status_filter = request.args.get('status')
    filter_start_date_str = request.args.get('filter_start_date')
    filter_end_date_str = request.args.get('filter_end_date')

    try:
        query = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                   .filter_by(user_id=current_user.id)

        if quest_id_filter_str:
            try:
                quest_uuid = uuid.UUID(quest_id_filter_str)
                query = query.filter(ScheduledMission.quest_id == quest_uuid)
            except ValueError:
                current_app.logger.warning(f"Invalid quest_id format for filter: {quest_id_filter_str}")
        
        if tag_ids_param:
            valid_tag_uuids = []
            for tid_str in tag_ids_param:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    current_app.logger.warning(f"Invalid tag_id format in tags filter: {tid_str}")
            
            if valid_tag_uuids:
                # Filtra misiones que tienen AL MENOS UNO de los tags especificados.
                # Si se necesita que tengan TODOS los tags, la lógica de query es más compleja (múltiples .any o subqueries).
                # Por ahora, implementamos que tenga CUALQUIERA de los tags.
                # query = query.filter(ScheduledMission.tags.any(Tag.id.in_(valid_tag_uuids)))
                # Para que la misión tenga TODOS los tags provistos:
                for tag_uuid_item in valid_tag_uuids:
                    query = query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))


        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED', 'SKIPPED']:
            query = query.filter(ScheduledMission.status == status_filter.upper())
        # Si no se provee status_filter, se devuelven todos los estados.

        filter_start_date_obj = parse_date_query_param(filter_start_date_str)
        filter_end_date_obj = parse_date_query_param(filter_end_date_str)

        # Ajustar el filtrado de fechas para que sea inclusivo y considere la hora completa del día
        if filter_start_date_obj:
            # Misiones que terminan en o después del inicio del día de filtro
            query = query.filter(ScheduledMission.end_datetime >= datetime.combine(filter_start_date_obj, datetime.min.time(), tzinfo=timezone.utc))
        if filter_end_date_obj:
            # Misiones que comienzan en o antes del fin del día de filtro
            query = query.filter(ScheduledMission.start_datetime <= datetime.combine(filter_end_date_obj, datetime.max.time(), tzinfo=timezone.utc))


        missions = query.order_by(ScheduledMission.start_datetime.asc()).all()
        
        missions_data = []
        for mission in missions:
            quest_name_val = mission.quest.name if mission.quest else None
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
        mission = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                    .filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404
        
        quest_name_val = mission.quest.name if mission.quest else None
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
    current_user = g.current_user # type: User

    mission_to_update = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
    if not mission_to_update:
        return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

    errors, start_datetime_obj, end_datetime_obj = validate_scheduled_mission_data(data, is_update=True)
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        old_status = mission_to_update.status
        original_mission_energy = mission_to_update.energy_value # Guardar valor original antes de posible update
        original_mission_points = mission_to_update.points_value # Guardar valor original antes de posible update
        
        # Actualizar campos básicos
        if 'title' in data: mission_to_update.title = data['title'].strip()
        if 'description' in data: mission_to_update.description = data['description'].strip() if data.get('description') else None
        if 'energy_value' in data: mission_to_update.energy_value = data['energy_value']
        if 'points_value' in data: mission_to_update.points_value = data['points_value']
        if start_datetime_obj: mission_to_update.start_datetime = start_datetime_obj
        if end_datetime_obj: mission_to_update.end_datetime = end_datetime_obj
        
        # Validar de nuevo start/end si alguno fue actualizado
        if start_datetime_obj or end_datetime_obj:
            if mission_to_update.end_datetime <= mission_to_update.start_datetime:
                 return jsonify({"errors": {"end_datetime": "End datetime must be after start datetime after update."}}), 400
        
        final_assigned_quest_object = mission_to_update.quest # Mantener el actual por defecto

        if 'quest_id' in data:
            quest_id_str = data.get('quest_id')
            if quest_id_str: # Si se provee un quest_id (no None y no vacío)
                try:
                    quest_uuid_to_assign = uuid.UUID(quest_id_str)
                    quest_to_assign = Quest.query.filter_by(id=quest_uuid_to_assign, user_id=current_user.id).first()
                    if not quest_to_assign:
                        return jsonify({"error": "Specified Quest not found or access denied for update."}), 404
                    mission_to_update.quest_id = quest_to_assign.id
                    final_assigned_quest_object = quest_to_assign
                except ValueError:
                     return jsonify({"error": "Invalid Quest ID format for update."}), 400
            else: # Si se provee quest_id como None o "", asignar a la default
                default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
                if not default_quest: 
                    current_app.logger.error(f"CRITICAL: User {current_user.id} missing default Quest during mission update.")
                    return jsonify({"error": "Default quest not found. Cannot update mission."}), 500
                mission_to_update.quest_id = default_quest.id
                final_assigned_quest_object = default_quest
        
        if 'tag_ids' in data:
            tag_ids_str_list = data.get('tag_ids', [])
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try: valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError: pass # Ignorar tags inválidos
            
            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                mission_to_update.tags = tags_to_associate
            else: # Si la lista está vacía o todos son inválidos
                mission_to_update.tags = []

        # Lógica de Puntos y Energía si el status cambia
        if 'status' in data:
            new_status = data['status']
            if new_status != old_status and new_status in ['PENDING', 'COMPLETED', 'SKIPPED']:
                mission_to_update.status = new_status
                points_change = 0
                log_reason = None
                is_completion_event = False # True si es una nueva completitud, False si es una reversión

                if new_status == 'COMPLETED': # Transición A COMPLETADO (desde PENDING o SKIPPED)
                    points_change = original_mission_points # Usar los puntos originales de la misión
                    log_reason = f"Completed Scheduled Mission: {mission_to_update.title}"
                    is_completion_event = True
                elif old_status == 'COMPLETED' and (new_status == 'PENDING' or new_status == 'SKIPPED'): # Reversión DESDE COMPLETADO
                    points_change = -original_mission_points # Revertir los puntos originales
                    log_reason = f"Reverted Scheduled Mission completion: {mission_to_update.title}"
                    is_completion_event = False # Esto es una reversión
                
                if log_reason: # Solo llamar si hay cambio de puntos/energía que registrar
                    update_user_stats_after_mission(
                        user=current_user,
                        points_to_change=points_change,
                        energy_value_for_log=original_mission_energy, # Usar la energía original de la misión
                        source_entity_type='SCHEDULED_MISSION',
                        source_entity_id=mission_to_update.id,
                        reason_text=log_reason,
                        is_completion=is_completion_event
                    )
        
        db.session.commit()
        
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission_to_update.tags]
        return jsonify({
            "id": str(mission_to_update.id),
            "title": mission_to_update.title,
            "description": mission_to_update.description,
            "energy_value": mission_to_update.energy_value, # Valor actualizado de la misión
            "points_value": mission_to_update.points_value, # Valor actualizado de la misión
            "start_datetime": mission_to_update.start_datetime.isoformat(),
            "end_datetime": mission_to_update.end_datetime.isoformat(),
            "status": mission_to_update.status,
            "quest_id": str(mission_to_update.quest_id) if mission_to_update.quest_id else None,
            "quest_name": final_assigned_quest_object.name if final_assigned_quest_object else None,
            "tags": mission_tags_data,
            "user_total_points": current_user.total_points, # Devolver stats actualizadas
            "user_level": current_user.level,
            "updated_at": mission_to_update.updated_at.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update scheduled mission"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>/status', methods=['PATCH'])
@token_required
def update_scheduled_mission_status(mission_id):
    data = request.get_json()
    current_user = g.current_user # type: User
    new_status = data.get('status')

    if not new_status or new_status.upper() not in ['PENDING', 'COMPLETED', 'SKIPPED']:
        return jsonify({"error": "Invalid or missing status. Must be 'PENDING', 'COMPLETED', or 'SKIPPED'."}), 400

    try:
        mission = ScheduledMission.query.options(db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags))\
                                   .filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

        old_status = mission.status
        
        if old_status == new_status.upper(): # No change, return current state
             quest_name_val = mission.quest.name if mission.quest else None
             mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]
             return jsonify({
                "id": str(mission.id), "title": mission.title, "description": mission.description,
                "energy_value": mission.energy_value, "points_value": mission.points_value,
                "start_datetime": mission.start_datetime.isoformat(), "end_datetime": mission.end_datetime.isoformat(),
                "status": mission.status,
                "quest_id": str(mission.quest_id) if mission.quest_id else None,
                "quest_name": quest_name_val,
                "tags": mission_tags_data,
                "user_total_points": current_user.total_points,
                "user_level": current_user.level,
                "updated_at": mission.updated_at.isoformat()
            }), 200

        mission.status = new_status.upper()
        
        # Gamification logic
        points_change = 0
        log_reason = None
        is_completion_event = False # True para nueva completitud, False para reversión

        if mission.status == 'COMPLETED': # Transition TO COMPLETED
            points_change = mission.points_value
            log_reason = f"Completed Scheduled Mission: {mission.title}"
            is_completion_event = True
        elif old_status == 'COMPLETED' and (mission.status == 'PENDING' or mission.status == 'SKIPPED'): # Reverting FROM COMPLETED
            points_change = -mission.points_value
            log_reason = f"Reverted Scheduled Mission completion: {mission.title}"
            is_completion_event = False # Esto es una reversión
        
        if log_reason: # Solo llamar si hay cambio de puntos/energía que registrar
            update_user_stats_after_mission(
                user=current_user,
                points_to_change=points_change,
                energy_value_for_log=mission.energy_value, # Energía original de la misión
                source_entity_type='SCHEDULED_MISSION',
                source_entity_id=mission.id,
                reason_text=log_reason,
                is_completion=is_completion_event
            )
            
        db.session.commit()

        quest_name_val = mission.quest.name if mission.quest else None
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]

        return jsonify({
            "id": str(mission.id),
            "title": mission.title, "description": mission.description,
            "energy_value": mission.energy_value, "points_value": mission.points_value,
            "start_datetime": mission.start_datetime.isoformat(), "end_datetime": mission.end_datetime.isoformat(),
            "status": mission.status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": quest_name_val,
            "tags": mission_tags_data,
            "user_total_points": current_user.total_points, # Devolver stats actualizadas
            "user_level": current_user.level,
            "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating status for scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update mission status"}), 500

@scheduled_mission_bp.route('/<uuid:mission_id>', methods=['DELETE'])
@token_required
def delete_scheduled_mission(mission_id):
    current_user = g.current_user
    try:
        mission_to_delete = ScheduledMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission_to_delete:
            return jsonify({"error": "Scheduled Mission not found or access denied"}), 404

        # Si la misión estaba completada, revertir puntos y energía
        if mission_to_delete.status == 'COMPLETED':
             update_user_stats_after_mission(
                user=current_user,
                points_to_change=-mission_to_delete.points_value, # Puntos a restar
                energy_value_for_log=mission_to_delete.energy_value, # La energía original
                source_entity_type='SCHEDULED_MISSION',
                source_entity_id=mission_to_delete.id,
                reason_text=f"Deleted completed Scheduled Mission: {mission_to_delete.title}",
                is_completion=False # Indica que es una reversión/cancelación para el EnergyLog
            )
        
        # Desasociar tags explícitamente antes de borrar (SQLAlchemy podría manejarlo con cascade, pero esto es más seguro)
        mission_to_delete.tags = [] # type: ignore 
        db.session.flush() # Aplicar la desasociación de tags
        
        mission_title_deleted = mission_to_delete.title
        db.session.delete(mission_to_delete)
        db.session.commit()
        
        return jsonify({
            "message": f"Scheduled Mission '{mission_title_deleted}' deleted successfully.",
            "user_total_points": current_user.total_points, # Devolver stats actualizadas
            "user_level": current_user.level
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting scheduled mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete scheduled mission"}), 500