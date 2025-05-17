// frontend/src/components/missions/pool/PoolMissionItem.jsx
import React from 'react';
import '../../../styles/poolmissions.css';

// Asegúrate que esta función (o una importada) esté disponible
// Renombrada y mejorada para manejar formatos #RGB y #RRGGBB, y devolver variables CSS o colores literales.
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) {
        return 'var(--color-text-on-dark, #EAEAEA)'; 
    }

    let r, g, b;
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hexColor = hexColor.replace(shorthandRegex, (m, rVal, gVal, bVal) => {
        return '#' + rVal + rVal + gVal + gVal + bVal + bVal;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!result) {
        return 'var(--color-text-on-dark, #EAEAEA)';
    }
    
    r = parseInt(result[1], 16);
    g = parseInt(result[2], 16);
    b = parseInt(result[3], 16);

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    // Devuelve directamente los valores de color literales para style={}
    return (yiq >= 128) ? '#0A192F' : '#EAEAEA'; 
}


function PoolMissionItem({ mission, onEdit, onDelete, onToggleFocus, onToggleComplete, questColors = {} }) {
    
    const handleCompleteToggle = () => {
        const newStatus = mission.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        onToggleComplete(mission, newStatus);
    };

    const handleFocusToggle = () => {
        const newFocusStatus = mission.focus_status === 'ACTIVE' ? 'DEFERRED' : 'ACTIVE';
        onToggleFocus(mission, newFocusStatus);
    };

    const questColor = mission.quest_id && questColors[mission.quest_id] ? questColors[mission.quest_id] : 'var(--color-accent-gold)';
    const textColorForQuestBadge = getContrastColor(questColor);


    return (
        <li className={`pool-mission-item status-${mission.status}`} style={{ borderLeftColor: questColor }}>
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
                <span>Energy: {mission.energy_value > 0 ? `+${mission.energy_value}` : mission.energy_value} | </span>
                <span>Points: {mission.points_value}</span>
            </div>

            {mission.tags && mission.tags.length > 0 && (
                <div className="pool-mission-tags-container">
                    {mission.tags.map(tag => (
                        <span key={tag.id} className="pool-mission-tag-badge">{tag.name}</span>
                    ))}
                </div>
            )}

            <div className="pool-mission-actions">
                <button 
                    onClick={handleCompleteToggle} 
                    className="action-icon complete-btn" // Añadido complete-btn para estilo específico
                    title={mission.status === 'COMPLETED' ? "Mark as Pending" : "Mark as Complete"}
                >
                   {mission.status === 'COMPLETED' ? 'Undo' : 'Complete'}
                </button>
                <button onClick={handleFocusToggle} className="action-icon" title={`Set as ${mission.focus_status === 'ACTIVE' ? 'Deferred' : 'Active'}`}>
                    {mission.focus_status === 'ACTIVE' ? 'Defer' : 'Activate'}
                </button>
                <button 
                    onClick={() => onEdit(mission)} 
                    className="action-icon" 
                    title="Edit Mission" 
                    disabled={mission.status === 'COMPLETED'} // No permitir editar si está completada
                >
                    Edit
                </button>
                <button onClick={() => onDelete(mission)} className="action-icon delete-btn" title="Delete Mission">
                    Delete
                </button>
            </div>
        </li>
    );
}

export default PoolMissionItem;