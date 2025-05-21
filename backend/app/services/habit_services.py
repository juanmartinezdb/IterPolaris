# backend/app/services/habit_services.py
from flask import current_app # <--- AÑADE ESTA LÍNEA
from datetime import datetime, timedelta, date, time, timezone
from app.models import db, HabitTemplate, HabitOccurrence, Quest 

# Días de la semana como constantes
WEEKDAY_MAP = {
    'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6
}
DAY_MAP_TO_STR = {v: k for k, v in WEEKDAY_MAP.items()}


def generate_occurrences_for_template(template: HabitTemplate, start_date_override: date = None, generation_days_limit: int = 30, force_regenerate_future: bool = False):
    """
    Genera ocurrencias para una plantilla de hábito.
    """
    if not template.is_active:
        HabitOccurrence.query.filter(
            HabitOccurrence.habit_template_id == template.id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= datetime.now(timezone.utc)
        ).delete(synchronize_session=False)
        # No es necesario comitear aquí si la función que llama (ej. update_template) hace commit general.
        # Sin embargo, si esta función se llama de forma aislada para desactivar, sí necesitaría un commit.
        # Por ahora, la lógica de commit está al final de la generación.
        current_app.logger.info(f"Deactivated habit {template.id}, future pending occurrences potentially deleted (commit pending).")
        return []

    current_time_utc = datetime.now(timezone.utc)
    current_date_utc = current_time_utc.date()

    if force_regenerate_future:
        HabitOccurrence.query.filter(
            HabitOccurrence.habit_template_id == template.id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= current_time_utc 
        ).delete(synchronize_session=False)
        current_app.logger.info(f"Force regenerate: Deleted future pending occurrences for template {template.id}.")
    
    start_generation_from_date = start_date_override if start_date_override else template.rec_pattern_start_date
    if not start_date_override and not force_regenerate_future: 
        last_occurrence = HabitOccurrence.query.filter_by(habit_template_id=template.id)\
            .order_by(HabitOccurrence.scheduled_start_datetime.desc()).first()
        if last_occurrence:
            potential_start = last_occurrence.scheduled_start_datetime.date() + timedelta(days=1)
            start_generation_from_date = max(potential_start, template.rec_pattern_start_date)

    if start_generation_from_date < current_date_utc and template.rec_pattern_start_date < current_date_utc:
         start_generation_from_date = max(start_generation_from_date, current_date_utc)

    effective_generation_end_date = template.rec_ends_on_date
    one_year_from_start = start_generation_from_date + timedelta(days=365)

    if template.rec_ends_on_date:
        if template.rec_ends_on_date > one_year_from_start:
            effective_generation_end_date = min(one_year_from_start, start_generation_from_date + timedelta(days=generation_days_limit -1))
        # else: # No es necesario, ya está asignado a template.rec_ends_on_date
    else: 
        effective_generation_end_date = start_generation_from_date + timedelta(days=generation_days_limit -1)

    if effective_generation_end_date < start_generation_from_date:
        current_app.logger.info(f"No occurrences to generate for template {template.id}. End date ({effective_generation_end_date}) is before start date ({start_generation_from_date}).")
        # Si hubo borrado por force_regenerate_future, necesitaríamos comitear ese borrado.
        if force_regenerate_future:
            try:
                db.session.commit()
            except Exception as e_commit:
                db.session.rollback()
                current_app.logger.error(f"Error committing deletions during no-op generation for template {template.id}: {e_commit}", exc_info=True)
        return []

    newly_generated_occurrences = []
    title = template.title
    description = template.description
    energy_value = template.default_energy_value
    points_value = template.default_points_value
    quest_id = template.quest_id
    if not quest_id and template.user_id: 
        user_default_quest = Quest.query.filter_by(user_id=template.user_id, is_default_quest=True).first()
        if user_default_quest:
            quest_id = user_default_quest.id
        else: 
            current_app.logger.error(f"Default quest not found for user {template.user_id} for template {template.id}")
            return []

    start_time_of_habit = template.rec_start_time if template.rec_start_time else time(0, 0, 0) 
    duration_minutes = template.rec_duration_minutes if template.rec_duration_minutes and template.rec_duration_minutes > 0 else 60 

    current_iter_date = start_generation_from_date
    while current_iter_date <= effective_generation_end_date:
        generate_for_this_date = False
        day_str_short = DAY_MAP_TO_STR.get(current_iter_date.weekday())
        
        if not template.rec_by_day or 'DAILY' in template.rec_by_day:
            generate_for_this_date = True
        elif 'WEEKLY' in template.rec_by_day:
            specific_days_in_rec = [d for d in template.rec_by_day if d not in ['WEEKLY', 'DAILY']]
            if not specific_days_in_rec:
                 generate_for_this_date = True
            elif day_str_short in specific_days_in_rec:
                generate_for_this_date = True
        elif day_str_short in template.rec_by_day:
            generate_for_this_date = True

        if generate_for_this_date:
            scheduled_start_dt = datetime.combine(current_iter_date, start_time_of_habit)
            # Asegurar que es timezone-aware (UTC) si start_time_of_habit es naive
            if scheduled_start_dt.tzinfo is None:
                scheduled_start_dt = scheduled_start_dt.replace(tzinfo=timezone.utc)
            else:
                scheduled_start_dt = scheduled_start_dt.astimezone(timezone.utc)

            scheduled_end_dt = scheduled_start_dt + timedelta(minutes=duration_minutes)

            existing_occ = HabitOccurrence.query.filter_by(
                habit_template_id=template.id,
                scheduled_start_datetime=scheduled_start_dt
            ).first()

            if not existing_occ:
                occurrence = HabitOccurrence(
                    habit_template_id=template.id, user_id=template.user_id, quest_id=quest_id,
                    title=title, description=description, energy_value=energy_value, points_value=points_value,
                    scheduled_start_datetime=scheduled_start_dt, scheduled_end_datetime=scheduled_end_dt,
                    status='PENDING'
                )
                db.session.add(occurrence)
                newly_generated_occurrences.append(occurrence)
        
        current_iter_date += timedelta(days=1)

    try:
        db.session.commit() 
        if newly_generated_occurrences: # Solo loguear si se generó algo nuevo
             current_app.logger.info(f"Generated {len(newly_generated_occurrences)} occurrences for template {template.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error committing generated occurrences for template {template.id}: {e}", exc_info=True)
        return [] 
        
    return newly_generated_occurrences