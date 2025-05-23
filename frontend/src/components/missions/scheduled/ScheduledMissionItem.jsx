// frontend/src/components/missions/scheduled/ScheduledMissionItem.jsx
import React from 'react';
import { getContrastColor } from '../../../utils/colorUtils'; // Import a la utilidad
import '../../../styles/scheduledmissions.css'; 

const formatDateForDisplay = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString(undefined, { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) {
        return 'Invalid Date';
    }
};


function ScheduledMissionItem({ mission, onEdit, onDelete, onUpdateStatus, questColors = {} }) {
    
    const questColor = mission.quest_id && questColors[mission.quest_id] 
        ? questColors[mission.quest_id] 
        : 'var(--color-accent-gold)';
    const textColorForQuestBadge = getContrastColor(questColor);

    const handleStatusUpdate = (newStatus) => {
        if (mission.status === newStatus) return; 
        onUpdateStatus(mission, newStatus);
    };

    return (
        <li 
            className={`scheduled-mission-item status-${mission.status}`} 
            style={{ borderLeftColor: questColor }}
        >
            <div className="scheduled-mission-header">
                <h4 className="scheduled-mission-title">{mission.title}</h4>
                <span className={`scheduled-mission-status-badge ${mission.status}`}>
                    {mission.status}
                </span>
            </div>

            <div className="scheduled-mission-datetime">
                <div><span className="label">Starts:</span> {formatDateForDisplay(mission.start_datetime)}</div>
                <div><span className="label">Ends:</span> {formatDateForDisplay(mission.end_datetime)}</div>
            </div>

            {mission.description && (
                <div className="scheduled-mission-details">
                    <p>{mission.description}</p>
                </div>
            )}
            
            <div className="scheduled-mission-meta">
                {mission.quest_name && (
                    <span 
                        className="quest-name-badge" 
                        style={{ 
                            borderColor: questColor, 
                            backgroundColor: questColor,
                            color: textColorForQuestBadge 
                        }}
                    >
                        {mission.quest_name}
                    </span>
                )}
                <span>Energy: {mission.energy_value > 0 ? `+${mission.energy_value}` : mission.energy_value} | </span>
                <span>Points: {mission.points_value}</span>
            </div>

            {mission.tags && mission.tags.length > 0 && (
                <div className="scheduled-mission-tags-container">
                    {mission.tags.map(tag => (
                        <span key={tag.id} className="scheduled-mission-tag-badge">{tag.name}</span>
                    ))}
                </div>
            )}

            <div className="scheduled-mission-actions">
                {mission.status === 'PENDING' && (
                    <>
                        <button 
                            onClick={() => handleStatusUpdate('COMPLETED')} 
                            className="action-icon complete-btn"
                            title="Mark as Complete"
                            aria-label={`Mark ${mission.title} as complete`}
                        >
                           Complete
                        </button>
                        <button 
                            onClick={() => handleStatusUpdate('SKIPPED')} 
                            className="action-icon skip-btn" 
                            title="Mark as Skipped"
                            aria-label={`Mark ${mission.title} as skipped`}
                        >
                           Skip
                        </button>
                    </>
                )}
                 {(mission.status === 'COMPLETED' || mission.status === 'SKIPPED') && (
                     <button 
                        onClick={() => handleStatusUpdate('PENDING')} 
                        className="action-icon"
                        title="Mark as Pending"
                        aria-label={`Mark ${mission.title} as pending`}
                    >
                       Undo
                    </button>
                 )}
                <button 
                    onClick={() => onEdit(mission)} 
                    className="action-icon" 
                    title="Edit Mission"
                    disabled={mission.status === 'COMPLETED' || mission.status === 'SKIPPED'}
                    aria-label={`Edit ${mission.title}`}
                >
                    Edit
                </button>
                <button 
                    onClick={() => onDelete(mission)} 
                    className="action-icon delete-btn" 
                    title="Delete Mission"
                    aria-label={`Delete ${mission.title}`}
                >
                    Delete
                </button>
            </div>
        </li>
    );
}

export default ScheduledMissionItem;