// frontend/src/components/habits/HabitTemplateList.jsx
import React from 'react';
import HabitTemplateItem from './HabitTemplateItem';
import '../../styles/habittemplates.css';

function HabitTemplateList({ templates, onEditTemplate, onDeleteTemplate, questColors, onGenerateOccurrences }) {
    if (!templates || templates.length === 0) {
        return <p style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'var(--font-secondary)' }}>
            No habit templates found. Create one to start building your routines!
        </p>;
    }

    return (
        <ul className="habit-template-list">
            {templates.map((template) => (
                <HabitTemplateItem
                    key={template.id}
                    template={template}
                    onEdit={onEditTemplate}
                    onDelete={onDeleteTemplate}
                    questColors={questColors}
                    onGenerateOccurrences={onGenerateOccurrences}
                />
            ))}
        </ul>
    );
}

export default HabitTemplateList;