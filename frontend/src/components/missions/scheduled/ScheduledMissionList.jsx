// frontend/src/components/missions/scheduled/ScheduledMissionList.jsx
import React from 'react';
import ScheduledMissionItem from './ScheduledMissionItem';
import '../../../styles/scheduledmissions.css';

function ScheduledMissionList({ 
    missions, 
    onEditMission, 
    onDeleteMission, 
    onUpdateMissionStatus,
    questColors 
}) {
    if (!missions || missions.length === 0) {
        return <p style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'var(--font-secondary)' }}>No scheduled missions found for the current filters. Try creating some or adjusting your filters!</p>;
    }

    return (
        <ul className="scheduled-mission-list">
            {missions.map((mission) => (
                <ScheduledMissionItem
                    key={mission.id}
                    mission={mission}
                    onEdit={onEditMission}
                    onDelete={onDeleteMission}
                    onUpdateStatus={onUpdateMissionStatus}
                    questColors={questColors}
                />
            ))}
        </ul>
    );
}

export default ScheduledMissionList;