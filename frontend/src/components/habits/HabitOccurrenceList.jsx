// frontend/src/components/habits/HabitOccurrenceList.jsx
import React from 'react';
import HabitOccurrenceItem from './HabitOccurrenceItem';
import '../../styles/habits.css'; // Ensure styles are available

function HabitOccurrenceList({ occurrences, onUpdateStatus, questColors, emptyListMessage }) {
    if (!occurrences || occurrences.length === 0) {
        return <p className="empty-state-message" style={{ textAlign: 'center', marginTop: '1rem' }}>
            {emptyListMessage || "No habit occurrences to display."}
        </p>;
    }

    return (
        <ul className="habit-occurrence-list panel-list-condensed"> {/* Added panel-list-condensed */}
            {occurrences.map((occurrence) => (
                <HabitOccurrenceItem
                    key={occurrence.id}
                    occurrence={occurrence}
                    onUpdateStatus={onUpdateStatus}
                    questColors={questColors}
                />
            ))}
        </ul>
    );
}

export default HabitOccurrenceList;