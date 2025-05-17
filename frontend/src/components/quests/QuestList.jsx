import React from 'react';
import '../../styles/quests.css'; // Asegúrate que los estilos para quest-item, etc., estén aquí

// Podríamos crear QuestItem como un sub-componente si se vuelve muy complejo,
// pero por ahora lo mantenemos dentro de QuestList para simplicidad.

function QuestList({ quests, onEditQuest, onDeleteQuest }) {
    if (!quests || quests.length === 0) {
        return <p style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'var(--font-secondary)' }}>No Quests found. Time to create your first epic Quest!</p>;
    }

    return (
        <ul className="quest-list">
            {quests.map((quest) => (
                <li 
                    key={quest.id} 
                    className="quest-item" 
                    style={{ borderLeftColor: quest.color || 'var(--color-accent-gold)' }} // Color del borde izquierdo
                >
                    <div className="quest-info">
                        <h4 className="quest-name">
                            {quest.name}
                            {quest.is_default_quest && (
                                <span className="quest-default-badge">DEFAULT</span>
                            )}
                        </h4>
                        {quest.description && (
                            <p className="quest-description">{quest.description}</p>
                        )}
                    </div>
                    <div className="quest-actions">
                        <button 
                            onClick={() => onEditQuest(quest)}
                            aria-label={`Edit Quest ${quest.name}`}
                        >
                            Edit
                        </button>
                        {!quest.is_default_quest && ( // No mostrar botón de eliminar para la Quest por defecto
                            <button 
                                onClick={() => onDeleteQuest(quest)}
                                className="delete-btn"
                                aria-label={`Delete Quest ${quest.name}`}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default QuestList;