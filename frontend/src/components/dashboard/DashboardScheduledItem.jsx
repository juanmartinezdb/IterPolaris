// frontend/src/components/dashboard/DashboardScheduledItem.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { getContrastColor } from '../../utils/colorUtils';
import '../../styles/missions-shared.css'; // Ensure this includes new energy classes

const formatDateForDashboard = (isoString, isAllDayEvent) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isAllDayEvent) {
            return "All-day"; 
        }
        const options = {
            hour: '2-digit', minute: '2-digit', hour12: false 
        };
        return date.toLocaleTimeString(navigator.language || 'en-GB', options);
    } catch (e) {
        console.error("Error formatting date for dashboard:", e);
        return 'Invalid Date';
    }
};

function DashboardScheduledItem({ item, questColor, onStatusUpdate }) {
    const effectiveQuestColor = questColor || 'var(--color-accent-gold)';
    const textColor = getContrastColor(effectiveQuestColor);
    const displayTime = formatDateForDashboard(item.start_datetime, item.is_all_day);

    const handleComplete = (e) => {
        e.stopPropagation(); 
        if (onStatusUpdate) onStatusUpdate(item, 'COMPLETED');
    };
    const handleSkip = (e) => {
        e.stopPropagation();
        if (onStatusUpdate) onStatusUpdate(item, 'SKIPPED');
    };

    let energyIcon = '';
    let energyValueClass = 'neutral';
    if (item.energy_value > 0) {
        energyIcon = '✨';
        energyValueClass = 'positive';
    } else if (item.energy_value < 0) {
        energyIcon = '💪';
        energyValueClass = 'negative';
    }
    
    let itemEnergyClass = '';
    if (item.energy_value > 0) itemEnergyClass = 'item-variant-energy-positive';
    else if (item.energy_value < 0) itemEnergyClass = 'item-variant-energy-negative';
    
    return (
        <li className={`upcoming-item ${itemEnergyClass}`} style={{ borderLeftColor: effectiveQuestColor }}>
            <div className="upcoming-item-main">
                <div className="upcoming-item-info">
                    <span className="upcoming-item-type-badge" style={{ backgroundColor: effectiveQuestColor, color: textColor }}>
                        Mission
                    </span>
                     <Link 
                        to={`/scheduled-missions#sm-${item.id}`} 
                        className="upcoming-item-title"
                        title={item.title}
                    >
                        {item.title}
                    </Link>
                    <span className="upcoming-item-time" title={new Date(item.start_datetime).toLocaleString()}>
                        {displayTime}
                    </span>
                </div>
                {item.status === 'PENDING' && (
                    <div className="upcoming-item-actions">
                        <button
                            onClick={handleComplete}
                            className="action-btn complete"
                            title="Mark as Complete"
                            aria-label={`Mark ${item.title} as Complete`}
                        >✓</button>
                        <button
                            onClick={handleSkip}
                            className="action-btn skip"
                            title="Mark as Skipped"
                            aria-label={`Mark ${item.title} as Skipped`}
                        >✕</button>
                    </div>
                )}
            </div>
             <div className="upcoming-item-meta-row" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)'}}>
                {item.quest_name && (
                     <span 
                        className="quest-name-badge-sm" 
                        style={{ 
                            backgroundColor: effectiveQuestColor, 
                            color: textColor,
                            borderColor: textColor === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark-muted)' : 'transparent'
                        }}
                        title={`Quest: ${item.quest_name}`}
                    >
                        {item.quest_name}
                    </span>
                )}
                <span className={`energy-display ${energyValueClass}`} style={{marginLeft: item.quest_name ? '0.5rem' : '0'}}>
                    <span className="icon" role="img" aria-label={`Energy: ${energyValueClass}`}>{energyIcon}</span>
                    <span className="value">{item.energy_value > 0 ? `+${item.energy_value}` : item.energy_value}</span>
                </span>
                <span>⭐ {item.points_value}</span>
            </div>
            {item.tags && item.tags.length > 0 && (
                <div className="upcoming-item-tags-container" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)'}}>
                    {item.tags.map(tag => (
                        <span key={tag.id} className="tag-badge-sm" title={`Tag: ${tag.name}`}>{tag.name}</span>
                    ))}
                </div>
            )}
        </li>
    );
}

export default DashboardScheduledItem;