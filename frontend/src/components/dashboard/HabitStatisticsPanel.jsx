// frontend/src/components/dashboard/HabitStatisticsPanel.jsx
import React from 'react';
import '../../styles/dashboard.css';

function HabitStatisticsPanel({ config, title }) {
    return (
        <div className="dashboard-panel habit-statistics-panel">
            <h3>{title || "Habit Statistics"}</h3>
            <p className="empty-state-message">Habit statistics coming soon!</p>
            {config && (
                 <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
            )}
        </div>
    );
}

export default HabitStatisticsPanel;