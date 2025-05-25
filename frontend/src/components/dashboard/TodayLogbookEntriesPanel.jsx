// frontend/src/components/dashboard/TodayLogbookEntriesPanel.jsx
import React from 'react';
import '../../styles/dashboard.css';

function TodayLogbookEntriesPanel({ config, title }) {
    return (
        <div className="dashboard-panel today-logbook-entries-panel">
            <h3>{title || "Today's Logbook Entries"}</h3>
            <p className="empty-state-message">Logbook feature coming soon!</p>
            {config && (
                 <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
            )}
        </div>
    );
}

export default TodayLogbookEntriesPanel;