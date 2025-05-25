// frontend/src/components/dashboard/EnergyStatisticsPanel.jsx
import React from 'react';
import '../../styles/dashboard.css';

function EnergyStatisticsPanel({ config, title }) {
    return (
        <div className="dashboard-panel energy-statistics-panel">
            <h3>{title || "Energy Statistics"}</h3>
            <p className="empty-state-message">Energy statistics coming soon!</p>
            {config && (
                 <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
            )}
        </div>
    );
}

export default EnergyStatisticsPanel;