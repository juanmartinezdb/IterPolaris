// frontend/src/components/habits/HabitOccurrenceItem.jsx
import React from 'react';
import '../../styles/habits.css';

// ... (getContrastColor, formatTimeForDisplay helpers) ...
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) return 'var(--color-text-on-dark, #EAEAEA)';
    let r, g, b;
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hexColor = hexColor.replace(shorthandRegex, (m, rVal, gVal, bVal) => '#' + rVal + rVal + gVal + gVal + bVal + bVal);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!result) return 'var(--color-text-on-dark, #EAEAEA)';
    [r, g, b] = result.slice(1).map(x => parseInt(x, 16));
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#0A192F' : '#EAEAEA';
}

const formatTimeForDisplay = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'Invalid Time'; }
};


function HabitOccurrenceItem({ occurrence, onUpdateStatus, questColors = {} }) {
    const questColor = occurrence.quest_id && questColors[occurrence.quest_id] 
        ? questColors[occurrence.quest_id] 
        : 'var(--color-accent-gold)';
    const textColorForQuestBadge = getContrastColor(questColor);

    const handleStatusClick = (clickedStatus) => {
        // Si se hace clic en el estado actual (y no es PENDING), revertir a PENDING.
        // Si se hace clic en un estado diferente, cambiar a ese nuevo estado.
        if (occurrence.status === clickedStatus && clickedStatus !== 'PENDING') {
            onUpdateStatus(occurrence.id, 'PENDING');
        } else if (occurrence.status !== clickedStatus) {
            onUpdateStatus(occurrence.id, clickedStatus);
        }
        // Si es PENDING y se hace clic en PENDING (teóricamente no debería haber botón para PENDING), no hacer nada.
    };

    return (
        <li 
            className={`habit-occurrence-item status-${occurrence.status}`}
            style={{ borderLeftColor: questColor }}
        >
            <div className="habit-occurrence-main">
                <div className="habit-occurrence-info">
                    <span className="habit-occurrence-time">
                        {formatTimeForDisplay(occurrence.scheduled_start_datetime)}
                        {occurrence.description && occurrence.rec_duration_minutes && // Solo mostrar si hay duración
                            <span className="habit-occurrence-duration"> (~{occurrence.rec_duration_minutes} min)</span>
                        }
                    </span>
                    <h5 className="habit-occurrence-title">{occurrence.title}</h5>
                    {occurrence.quest_name && (
                        <span 
                            className="quest-name-badge-sm"
                            style={{ backgroundColor: questColor, color: textColorForQuestBadge, borderColor: questColor }}
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
                        // No deshabilitar, permitir clic para revertir
                    >✓</button>
                    <button 
                        className={`status-btn skip ${occurrence.status === 'SKIPPED' ? 'active' : ''}`}
                        onClick={() => handleStatusClick('SKIPPED')}
                        title={occurrence.status === 'SKIPPED' ? "Mark Pending" : "Mark Skipped"}
                        // No deshabilitar, permitir clic para revertir
                    >✕</button>
                </div>
            </div>
            <div className="habit-occurrence-meta">
                <span>⚡ {occurrence.energy_value > 0 ? `+${occurrence.energy_value}` : occurrence.energy_value}</span>
                <span style={{marginLeft: '0.5rem'}}>⭐ {occurrence.points_value}</span>
            </div>
        </li>
    );
}

export default HabitOccurrenceItem;