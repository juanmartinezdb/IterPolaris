// frontend/src/components/missions/pool/PoolMissionList.jsx
import React from 'react';
import PoolMissionItem from './PoolMissionItem';
import '../../../styles/poolmissions.css';

function PoolMissionList({ 
    missions, 
    title = "Missions", // Provide a default title
    onEditMission, 
    onDeleteMission, 
    onToggleFocusStatus, 
    onToggleCompleteStatus,
    questColors 
}) {
    if (!missions || missions.length === 0) {
        // Use a generic message if title might be intentionally omitted for a main list
        const displayTitle = title || "missions"; // Fallback for the message
        return <p style={{ textAlign: 'center', marginTop: '1rem', fontFamily: 'var(--font-secondary)' }}>No {displayTitle.toLowerCase()} here. Time to add some!</p>;
    }

    return (
        <>
            {title && <h4>{title}</h4>} 
            <ul className="pool-mission-list">
                {missions.map((mission) => (
                    <PoolMissionItem
                        key={mission.id}
                        mission={mission}
                        onEdit={onEditMission}
                        onDelete={onDeleteMission}
                        onToggleFocus={onToggleFocusStatus}
                        onToggleComplete={onToggleCompleteStatus}
                        questColors={questColors}
                    />
                ))}
            </ul>
        </>
    );
}

export default PoolMissionList;