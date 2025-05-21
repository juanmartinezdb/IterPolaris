// frontend/src/components/habits/HabitTemplateItem.jsx
import React from 'react';
import '../../styles/habittemplates.css'; // Usaremos los estilos definidos aquí

// Helper para getContrastColor (idealmente en un archivo utils)
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
    return (yiq >= 128) ? '#0A192F' : '#EAEAEA';
}

// Helper para formatear la recurrencia para mostrar
const formatRecurrenceForDisplay = (template) => {
    if (!template) return 'N/A';
    let recString = '';
    if (template.rec_by_day && template.rec_by_day.length > 0) {
        if (template.rec_by_day.includes('DAILY')) {
            recString = 'Daily';
        } else if (template.rec_by_day.includes('WEEKLY')) {
            // Podrías ser más específico si hay días seleccionados con WEEKLY
            recString = 'Weekly';
        } else {
            recString = template.rec_by_day.join(', ');
        }
    } else {
        recString = 'No specific days';
    }

    if (template.rec_start_time) {
        recString += ` at ${template.rec_start_time.substring(0,5)}`;
    }
    return recString;
};

function HabitTemplateItem({ template, onEdit, onDelete, questColors = {}, onGenerateOccurrences }) {
    const questColor = template.quest_id && questColors[template.quest_id] 
        ? questColors[template.quest_id] 
        : 'var(--color-accent-gold)';
    const textColorForQuestBadge = getContrastColor(questColor);

    return (
        <li 
            className={`habit-template-item status-${template.is_active ? 'active' : 'inactive'}`}
            style={{ borderLeftColor: questColor }}
        >
            <div className="habit-template-item-header">
                <h4 className="habit-template-title">{template.title}</h4>
                <span className={`habit-template-status-badge ${template.is_active ? 'active' : 'inactive'}`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>

            {template.description && (
                <p className="habit-template-details">{template.description}</p>
            )}

            <div className="habit-template-recurrence">
                <strong>Repeats:</strong> {formatRecurrenceForDisplay(template)}
            </div>
            {template.rec_duration_minutes && (
                 <div className="habit-template-details">
                    <strong>Duration:</strong> {template.rec_duration_minutes} min
                </div>
            )}
             <div className="habit-template-details">
                <strong>Pattern Starts:</strong> {new Date(template.rec_pattern_start_date).toLocaleDateString()}
                {template.rec_ends_on_date && (
                    <span> | <strong>Ends:</strong> {new Date(template.rec_ends_on_date).toLocaleDateString()}</span>
                )}
            </div>


            <div className="habit-template-meta">
                {template.quest_name && (
                    <span 
                        className="quest-name-badge" 
                        style={{ 
                            borderColor: questColor, 
                            backgroundColor: questColor,
                            color: textColorForQuestBadge 
                        }}
                    >
                        {template.quest_name}
                    </span>
                )}
                <span>Energy: {template.default_energy_value > 0 ? `+${template.default_energy_value}` : template.default_energy_value} | </span>
                <span>Points: {template.default_points_value}</span>
            </div>

            {template.tags && template.tags.length > 0 && (
                <div className="scheduled-mission-tags-container"> {/* Reutilizar clase si el estilo es el mismo */}
                    {template.tags.map(tag => (
                        <span key={tag.id} className="scheduled-mission-tag-badge">{tag.name}</span>
                    ))}
                </div>
            )}

            <div className="habit-template-actions">
                <button onClick={() => onEdit(template)} title="Edit Template">Edit</button>
                <button 
                    onClick={() => onGenerateOccurrences(template)} 
                    title="Generate more occurrences for the next 30 days"
                    disabled={!template.is_active}
                >
                    Extend
                </button>
                <button onClick={() => onDelete(template)} className="delete-btn" title="Delete Template">Delete</button>
            </div>
        </li>
    );
}

export default HabitTemplateItem;