// frontend/src/components/calendar/EventActionMenu.jsx
import React, { useEffect, useRef } from 'react';
import '../../styles/calendar.css'; // Ensure styles are loaded

function EventActionMenu({ x, y, event, onClose, onAction }) {
    const menuRef = useRef(null);
    
    const eventType = event?.resource?.type;
    const missionStatus = event?.resource?.original?.status;
    const originalEventData = event?.resource?.original;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (!event || !originalEventData) return null;

    const canEditOrDeleteScheduled = eventType === 'SCHEDULED_MISSION' && missionStatus === 'PENDING';
    const canMoveToPool = eventType === 'SCHEDULED_MISSION'; 
    const canExtendHabit = eventType === 'HABIT_OCCURRENCE' && originalEventData.habit_template_id;
    const canDeleteHabitTemplate = eventType === 'HABIT_OCCURRENCE' && originalEventData.habit_template_id;


    return (
        <div
            ref={menuRef}
            className="event-action-menu"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()} 
        >
            <div className="event-action-menu-title">{event.title}</div>
            <ul>
                {/* Common Status Actions */}
                {missionStatus === 'PENDING' && (
                    <>
                        <li onClick={() => onAction('complete', event)}>Mark Complete</li>
                        <li onClick={() => onAction('skip', event)}>Mark Skipped</li>
                    </>
                )}
                {(missionStatus === 'COMPLETED' || missionStatus === 'SKIPPED') && (
                    <li onClick={() => onAction('pending', event)}>Mark Pending (Undo)</li>
                )}

                {/* ScheduledMission specific actions */}
                {eventType === 'SCHEDULED_MISSION' && (
                    <>
                        <hr className="action-menu-separator" />
                        <li onClick={() => { if (canEditOrDeleteScheduled) onAction('edit_scheduled_mission', event);}} 
                            className={!canEditOrDeleteScheduled ? 'disabled' : ''}>
                            Edit Mission
                        </li>
                        <li onClick={() => { if (canMoveToPool) onAction('move_to_pool', event);}}
                            className={!canMoveToPool ? 'disabled' : ''}
                        >
                            Move to Pool
                        </li>
                        <li onClick={() => { if (canEditOrDeleteScheduled) onAction('delete_scheduled_mission', event);}} 
                            className={!canEditOrDeleteScheduled ? 'disabled delete' : 'delete'}>
                            Delete Mission
                        </li>
                    </>
                )}

                {/* HabitOccurrence specific actions */}
                {eventType === 'HABIT_OCCURRENCE' && (
                    <>
                        <hr className="action-menu-separator" />
                        <li onClick={() => onAction('edit_habit_template', event)}>
                            Edit Habit Definition
                        </li>
                        <li onClick={() => { if (canExtendHabit) onAction('extend_habit', event);}}
                            className={!canExtendHabit ? 'disabled' : ''}>
                            Extend Habit (30 days)
                        </li>
                        <li onClick={() => {if (canDeleteHabitTemplate) onAction('delete_habit_template', event);}}
                            className={!canDeleteHabitTemplate ? 'disabled delete' : 'delete'}>
                            Delete Habit Template
                        </li>
                    </>
                )}
            </ul>
        </div>
    );
}

export default EventActionMenu;