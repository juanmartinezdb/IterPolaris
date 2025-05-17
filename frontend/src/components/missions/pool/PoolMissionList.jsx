// frontend/src/components/missions/pool/PoolMissionList.jsx
import React from 'react';
import PoolMissionItem from './PoolMissionItem';
import '../../../styles/poolmissions.css';

function PoolMissionList({ 
    missions, 
    title, 
    onEditMission, 
    onDeleteMission, 
    onToggleFocusStatus, 
    onToggleCompleteStatus,
    questColors // Objeto { quest_id: color_hex }
}) {
    if (!missions || missions.length === 0) {
        return <p style={{ textAlign: 'center', marginTop: '1rem', fontFamily: 'var(--font-secondary)' }}>No {title.toLowerCase()} missions here. Time to add some!</p>;
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