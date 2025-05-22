// frontend/src/components/calendar/EventActionMenu.jsx
import React, { useEffect, useRef } from 'react';
import '../../styles/calendar.css';

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
    // "Move to Pool" should be available for any scheduled mission, regardless of status,
    // as it's a conversion, not just an edit of the scheduled instance.
    const canMoveToPool = eventType === 'SCHEDULED_MISSION'; 
    const canExtendHabit = eventType === 'HABIT_OCCURRENCE';

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
                            className={!canMoveToPool ? 'disabled' : ''} // Should always be enabled for SM
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
                    </>
                )}
            </ul>
        </div>
    );
}

export default EventActionMenu;