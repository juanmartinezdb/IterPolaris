# backend/app/services/habit_services.py
from flask import current_app
from datetime import datetime, timedelta, date, time, timezone
from app.models import db, HabitTemplate, HabitOccurrence, Quest 

WEEKDAY_MAP = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}
DAY_MAP_TO_STR = {v: k for k, v in WEEKDAY_MAP.items()}

def generate_occurrences_for_template(template: HabitTemplate, start_date_override: date = None, generation_days_limit: int = 30, force_regenerate_future: bool = False):
    if not template.is_active:
        # If deactivated, delete future PENDING occurrences
        HabitOccurrence.query.filter(
            HabitOccurrence.habit_template_id == template.id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= datetime.now(timezone.utc)
        ).delete(synchronize_session=False)
        current_app.logger.info(f"Deactivated habit {template.id}. Future pending occurrences (if any) marked for deletion.")
        # The calling function should handle the commit.
        return []

    current_time_utc = datetime.now(timezone.utc)
    current_date_utc = current_time_utc.date()

    if force_regenerate_future:
        # Determine the date from which to start deleting future pending occurrences.
        # If rec_pattern_start_date is in the past, delete from today onwards.
        # If rec_pattern_start_date is in the future, delete from that future date onwards.
        date_threshold_for_deletion = template.rec_pattern_start_date
        if date_threshold_for_deletion < current_date_utc:
            date_threshold_for_deletion = current_date_utc
        
        datetime_threshold_for_deletion = datetime.combine(date_threshold_for_deletion, time.min, tzinfo=timezone.utc)

        deleted_count = HabitOccurrence.query.filter(
            HabitOccurrence.habit_template_id == template.id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= datetime_threshold_for_deletion
        ).delete(synchronize_session=False)
        current_app.logger.info(f"Force regenerate: Deleted {deleted_count} pending occurrences from {datetime_threshold_for_deletion.isoformat()} onwards for template {template.id}.")

    start_generation_from_date = start_date_override if start_date_override else template.rec_pattern_start_date
    
    if not start_date_override and not force_regenerate_future: 
        last_occurrence = HabitOccurrence.query.filter_by(habit_template_id=template.id)\
            .order_by(HabitOccurrence.scheduled_start_datetime.desc()).first()
        if last_occurrence:
            potential_start = last_occurrence.scheduled_start_datetime.date() + timedelta(days=1)
            start_generation_from_date = max(potential_start, template.rec_pattern_start_date)

    # Ensure we don't try to generate for past dates unless it's an override or forced regeneration that might affect today.
    if start_generation_from_date < current_date_utc and template.rec_pattern_start_date < current_date_utc:
         start_generation_from_date = max(start_generation_from_date, current_date_utc)


    effective_generation_end_date = template.rec_ends_on_date
    one_year_from_start = start_generation_from_date + timedelta(days=365) # Max generation window of 1 year at a time

    if template.rec_ends_on_date:
        # If rec_ends_on_date is specified, generate up to it, but cap at 1 year or generation_days_limit from start_generation_from_date
        max_end_by_limit = start_generation_from_date + timedelta(days=generation_days_limit -1)
        effective_generation_end_date = min(template.rec_ends_on_date, one_year_from_start, max_end_by_limit)
    else: 
        # No specific end date, so generate for generation_days_limit or up to 1 year, whichever is shorter
        effective_generation_end_date = min(one_year_from_start, start_generation_from_date + timedelta(days=generation_days_limit -1))


    if effective_generation_end_date < start_generation_from_date:
        current_app.logger.info(f"No new occurrences to generate for template {template.id}. End date ({effective_generation_end_date}) is before start date ({start_generation_from_date}).")
        if force_regenerate_future: # If we deleted occurrences, we still need to commit that.
            try: db.session.commit()
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
        if user_default_quest: quest_id = user_default_quest.id
        else: 
            current_app.logger.error(f"Default quest not found for user {template.user_id} for template {template.id}")
            return [] # Cannot proceed without a quest

    is_all_day_habit = template.rec_start_time is None
    
    current_iter_date = start_generation_from_date
    while current_iter_date <= effective_generation_end_date:
        generate_for_this_date = False
        day_str_short = DAY_MAP_TO_STR.get(current_iter_date.weekday())
        
        if not template.rec_by_day or 'DAILY' in template.rec_by_day:
            generate_for_this_date = True
        elif 'WEEKLY' in template.rec_by_day:
            specific_days_in_rec = [d for d in template.rec_by_day if d not in ['WEEKLY', 'DAILY']]
            if not specific_days_in_rec: generate_for_this_date = True # If only 'WEEKLY', it's like daily within the week
            elif day_str_short in specific_days_in_rec: generate_for_this_date = True
        elif day_str_short in template.rec_by_day:
            generate_for_this_date = True

        if generate_for_this_date:
            scheduled_start_dt_utc: datetime
            scheduled_end_dt_utc: datetime

            if is_all_day_habit:
                scheduled_start_dt_utc = datetime.combine(current_iter_date, time.min, tzinfo=timezone.utc)
                scheduled_end_dt_utc = datetime.combine(current_iter_date, time.max, tzinfo=timezone.utc)
            else:
                # Ensure rec_start_time is used if template has one
                start_time_of_habit = template.rec_start_time # Should not be None here
                duration_minutes = template.rec_duration_minutes if template.rec_duration_minutes and template.rec_duration_minutes > 0 else 60
                
                # Combine date and time, then ensure UTC
                scheduled_start_dt_naive = datetime.combine(current_iter_date, start_time_of_habit)
                if scheduled_start_dt_naive.tzinfo is None: # If rec_start_time was naive
                    scheduled_start_dt_utc = scheduled_start_dt_naive.replace(tzinfo=timezone.utc)
                else: # If rec_start_time had timezone info (though model implies naive TIME)
                    scheduled_start_dt_utc = scheduled_start_dt_naive.astimezone(timezone.utc)
                
                scheduled_end_dt_utc = scheduled_start_dt_utc + timedelta(minutes=duration_minutes)

            # Check for existing occurrence for this exact start time (handles no-change updates)
            existing_occ = HabitOccurrence.query.filter_by(
                habit_template_id=template.id,
                scheduled_start_datetime=scheduled_start_dt_utc 
            ).first()

            if not existing_occ:
                occurrence = HabitOccurrence(
                    habit_template_id=template.id, user_id=template.user_id, quest_id=quest_id,
                    title=title, description=description, energy_value=energy_value, points_value=points_value,
                    scheduled_start_datetime=scheduled_start_dt_utc, 
                    scheduled_end_datetime=scheduled_end_dt_utc,
                    is_all_day=is_all_day_habit, # Set the new field
                    status='PENDING'
                )
                db.session.add(occurrence)
                newly_generated_occurrences.append(occurrence)
        
        current_iter_date += timedelta(days=1)

    try:
        db.session.commit() 
        if newly_generated_occurrences:
             current_app.logger.info(f"Generated {len(newly_generated_occurrences)} new occurrences for template {template.id}")
        elif force_regenerate_future and deleted_count > 0: # type: ignore
             current_app.logger.info(f"Committed deletion of {deleted_count} occurrences for template {template.id} due to regeneration.") # type: ignore
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error committing generated/deleted occurrences for template {template.id}: {e}", exc_info=True)
        return [] 
        
    return newly_generated_occurrences