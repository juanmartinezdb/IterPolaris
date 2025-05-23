// frontend/src/components/quests/QuestList.jsx
import React from 'react';
import { getContrastColor } from '../../utils/colorUtils'; // Import a la utilidad
import '../../styles/quests.css';

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
                    style={{ borderLeftColor: quest.color || 'var(--color-accent-gold)' }}
                >
                    <div className="quest-info">
                        <h4 className="quest-name" style={{ color: getContrastColor(quest.color) === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark, #EAEAEA)' : 'var(--color-text-on-dark, #EAEAEA)' }}> 
                            {/* Simplified logic for name color, primary text color should be fine for most quest colors */}
                            {/* For very light quest colors, specific darker text might be needed, but this is a general approach */}
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
                        {!quest.is_default_quest && ( 
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