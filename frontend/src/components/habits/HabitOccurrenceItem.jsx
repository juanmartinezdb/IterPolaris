// frontend/src/components/habits/HabitOccurrenceItem.jsx
import React from 'react';
import { getContrastColor } from '../../utils/colorUtils';
import '../../styles/habits.css';
import '../../styles/missions-shared.css'; // For energy display and item variants

const formatTimeForDisplay = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString(navigator.language || 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return 'Invalid Time'; }
};

function HabitOccurrenceItem({ occurrence, onUpdateStatus, questColors = {} }) {
    
    let questColor = 'var(--color-accent-gold)'; 
    if (occurrence.quest_id && questColors && questColors[occurrence.quest_id]) {
        questColor = questColors[occurrence.quest_id];
    } else if (!occurrence.quest_id) { 
        questColor = 'var(--color-purple-mystic, #6D21A9)';
    }
    
    const textColorForQuestBadge = getContrastColor(questColor);

    const handleStatusClick = (clickedStatus) => {
        if (occurrence.status === clickedStatus && clickedStatus !== 'PENDING') {
            onUpdateStatus(occurrence.id, 'PENDING');
        } else if (occurrence.status !== clickedStatus) {
            onUpdateStatus(occurrence.id, clickedStatus);
        }
    };
    
    const durationDisplay = occurrence.rec_duration_minutes 
        ? ` (~${occurrence.rec_duration_minutes} min)`
        : '';
    
    const tagsToDisplay = Array.isArray(occurrence.tags) ? occurrence.tags : [];

    let energyIcon = '';
    let energyValueClass = 'neutral';
    if (occurrence.energy_value > 0) {
        energyIcon = '✨';
        energyValueClass = 'positive';
    } else if (occurrence.energy_value < 0) {
        energyIcon = '💪';
        energyValueClass = 'negative';
    }

    let itemEnergyClass = '';
    if (occurrence.energy_value > 0) itemEnergyClass = 'item-variant-energy-positive';
    else if (occurrence.energy_value < 0) itemEnergyClass = 'item-variant-energy-negative';

    return (
        <li 
            className={`habit-occurrence-item status-${occurrence.status} ${itemEnergyClass}`}
            style={{ borderLeftColor: questColor }}
        >
            <div className="habit-occurrence-main">
                <div className="habit-occurrence-info">
                    <span className="habit-occurrence-time">
                        {formatTimeForDisplay(occurrence.scheduled_start_datetime)}
                        {durationDisplay}
                    </span>
                    <h5 className="habit-occurrence-title" title={occurrence.title}>{occurrence.title}</h5>
                    {occurrence.quest_name && ( 
                        <span 
                            className="quest-name-badge-sm" 
                            style={{ 
                                backgroundColor: questColor, 
                                color: textColorForQuestBadge,
                                borderColor: textColorForQuestBadge === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark-muted)' : 'transparent'
                            }}
                            title={`Quest: ${occurrence.quest_name}`}
                        >
                            {occurrence.quest_name}
                        </span>
                    )}
                </div>
                <div className="habit-occurrence-actions">
                    <button 
                        className={`status-btn complete ${occurrence.status === 'COMPLETED' ? 'active' : ''}`}
                        onClick={() => handleStatusClick('COMPLETED')}
                        title={occurrence.status === 'COMPLETED' ? "Mark Pending" : "Mark Completed"}
                        aria-label={occurrence.status === 'COMPLETED' ? `Mark ${occurrence.title} as pending` : `Mark ${occurrence.title} as completed`}
                    >✓</button>
                    <button 
                        className={`status-btn skip ${occurrence.status === 'SKIPPED' ? 'active' : ''}`}
                        onClick={() => handleStatusClick('SKIPPED')}
                        title={occurrence.status === 'SKIPPED' ? "Mark Pending" : "Mark Skipped"}
                        aria-label={occurrence.status === 'SKIPPED' ? `Mark ${occurrence.title} as pending` : `Mark ${occurrence.title} as skipped`}
                    >✕</button>
                </div>
            </div>
            {occurrence.description && (
                 <p className="habit-occurrence-description">{occurrence.description}</p>
            )}
            {tagsToDisplay.length > 0 && (
                <div className="upcoming-item-tags-container" style={{ paddingLeft: '0', marginTop: '0.3rem' }}>
                    {tagsToDisplay.map(tag => (
                        <span key={tag.id} className="tag-badge-sm" title={`Tag: ${tag.name}`}>{tag.name}</span>
                    ))}
                </div>
            )}
            <div className="habit-occurrence-meta">
                <span className={`energy-display ${energyValueClass}`}>
                    <span className="icon" role="img" aria-label={`Energy: ${energyValueClass}`}>{energyIcon}</span>
                    <span className="value">{occurrence.energy_value > 0 ? `+${occurrence.energy_value}` : occurrence.energy_value}</span>
                </span>
                <span style={{marginLeft: '0.5rem'}}>⭐ {occurrence.points_value}</span>
            </div>
        </li>
    );
}

export default HabitOccurrenceItem;