// frontend/src/components/missions/pool/PoolMissionItem.jsx
import React from 'react';
import { getContrastColor } from '../../../utils/colorUtils';
import '../../../styles/poolmissions.css'; // Main styles
import '../../../styles/missions-shared.css'; // For new energy display classes

function PoolMissionItem({ 
    mission, 
    questColors = {}, 
    onDragStart,
    onEdit,
    onDelete,
    onToggleFocus,
    onToggleComplete 
}) {
    
    const handleCompleteToggle = () => {
        if (onToggleComplete) { 
            const newStatus = mission.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
            onToggleComplete(mission, newStatus);
        }
    };

    const handleFocusToggle = () => {
        if (onToggleFocus) { 
            const newFocusStatus = mission.focus_status === 'ACTIVE' ? 'DEFERRED' : 'ACTIVE';
            onToggleFocus(mission, newFocusStatus);
        }
    };

    const questColor = mission.quest_id && questColors[mission.quest_id] ? questColors[mission.quest_id] : 'var(--color-accent-gold)';
    const textColorForQuestBadge = getContrastColor(questColor);

    const handleNativeDragStart = (e) => {
        if (onDragStart && mission.status === 'PENDING') {
            onDragStart(mission); 
        } else if (mission.status !== 'PENDING') {
            e.preventDefault(); 
        }
    };

    let energyIcon = '';
    let energyValueClass = 'neutral';
    if (mission.energy_value > 0) {
        energyIcon = '✨';
        energyValueClass = 'positive';
    } else if (mission.energy_value < 0) {
        energyIcon = '💪';
        energyValueClass = 'negative';
    }

    let itemEnergyClass = '';
    if (mission.energy_value > 0) itemEnergyClass = 'item-variant-energy-positive';
    else if (mission.energy_value < 0) itemEnergyClass = 'item-variant-energy-negative';

    return (
        <li 
            className={`pool-mission-item status-${mission.status} ${itemEnergyClass}`} 
            style={{ borderLeftColor: questColor }}
            draggable={mission.status === 'PENDING'}
            onDragStart={handleNativeDragStart}
            title={mission.status === 'PENDING' ? "Drag to calendar to schedule or manage below" : "Mission completed"}
        >
            <div className="pool-mission-header">
                <h4 className="pool-mission-title">{mission.title}</h4>
                {mission.focus_status && (
                     <span className={`pool-mission-focus-status ${mission.focus_status}`}>
                        {mission.focus_status}
                    </span>
                )}
            </div>

            {mission.description && (
                <div className="pool-mission-details">
                    <p>{mission.description}</p>
                </div>
            )}
            
            <div className="pool-mission-meta">
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
                <span className={`energy-display ${energyValueClass}`}>
                    <span className="icon" role="img" aria-label={`Energy: ${energyValueClass}`}>{energyIcon}</span>
                    <span className="value">{mission.energy_value > 0 ? `+${mission.energy_value}` : mission.energy_value}</span>
                </span>
                <span>⭐ {mission.points_value}</span> {/* Using star for points */}
            </div>

            {mission.tags && mission.tags.length > 0 && (
                <div className="pool-mission-tags-container"> {/* This class is from poolmissions.css */}
                    {mission.tags.map(tag => (
                        <span key={tag.id} className="pool-mission-tag-badge">{tag.name}</span>
                    ))}
                </div>
            )}

            <div className="pool-mission-actions">
                <button 
                    onClick={handleCompleteToggle} 
                    className="action-icon complete-btn"
                    title={mission.status === 'COMPLETED' ? "Mark as Pending" : "Mark as Complete"}
                    aria-label={mission.status === 'COMPLETED' ? `Mark ${mission.title} as pending` : `Mark ${mission.title} as complete`}
                >
                   {mission.status === 'COMPLETED' ? 'Undo' : 'Complete'}
                </button>
                <button 
                    onClick={handleFocusToggle} 
                    className="action-icon" 
                    title={`Set as ${mission.focus_status === 'ACTIVE' ? 'Deferred' : 'Active'}`}
                    disabled={mission.status === 'COMPLETED'}
                    aria-label={mission.focus_status === 'ACTIVE' ? `Set ${mission.title} as deferred` : `Set ${mission.title} as active`}
                >
                    {mission.focus_status === 'ACTIVE' ? 'Defer' : 'Activate'}
                </button>
                <button 
                    onClick={() => onEdit ? onEdit(mission) : console.error("onEdit not provided to PoolMissionItem")} 
                    className="action-icon" 
                    title="Edit Mission" 
                    disabled={mission.status === 'COMPLETED'}
                    aria-label={`Edit ${mission.title}`}
                >
                    Edit
                </button>
                <button 
                    onClick={() => onDelete ? onDelete(mission) : console.error("onDelete not provided to PoolMissionItem")} 
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

export default PoolMissionItem;