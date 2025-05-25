// frontend/src/pages/DashboardPage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext'; 

import MissionPoolPanel from '../components/dashboard/MissionPoolPanel';
import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel'; 
import UpcomingMissionsPanel from '../components/dashboard/UpcomingMissionsPanel';

const ProjectTasksPanel = ({ config, activeTagFilters, title }) => ( 
    <div className="dashboard-panel project-tasks-panel">
        <h3>{title || `Project Panel`}</h3> {/* Use title prop */}
        <p className="empty-state-message">Project-specific content for Quest ID: {config.quest_id} will appear here.</p>
        <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
    </div>
);

const TodaysAgendaPanel = ({ config, activeTagFilters, title }) => ( 
    <div className="dashboard-panel todays-agenda-panel">
        <h3>{title || "Today's Full Agenda"}</h3> {/* Use title prop */}
        <p className="empty-state-message">Today's full agenda (all-day, habits, timed) will appear here.</p>
         <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
    </div>
);

import '../App.css'; 
import '../styles/dashboard.css'; 

function DashboardPage({ activeTagFilters }) {
    const { currentUser } = useContext(UserContext);
    const [renderedPanelsList, setRenderedPanelsList] = useState([]);
    const userName = currentUser?.name || 'Adventurer';

    useEffect(() => {
        if (currentUser?.settings?.dashboard_panels) {
            const activePanelConfigs = currentUser.settings.dashboard_panels
                .filter(panel => panel.is_active)
                .sort((a, b) => a.order - b.order);

            const panelsToRender = activePanelConfigs.map(panelConfig => {
                // Props for the panel, EXCLUDING 'key'
                const panelComponentProps = { 
                    config: panelConfig,
                    activeTagFilters: activeTagFilters,
                    title: panelConfig.name // Pass user-defined name as title
                };

                // The 'key' prop is applied directly to the component instance
                switch (panelConfig.panel_type) {
                    case "UPCOMING_MISSIONS":
                        return <UpcomingMissionsPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "MISSION_POOL":
                        return <MissionPoolPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "TODAY_HABITS":
                        return <TodaysHabitsPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "PROJECT_TASKS":
                        return <ProjectTasksPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "TODAY_AGENDA":
                        return <TodaysAgendaPanel key={panelConfig.id} {...panelComponentProps} />;
                    default:
                        console.warn("Unknown panel type in dashboard config:", panelConfig.panel_type);
                        return (
                            <div key={panelConfig.id} className="dashboard-panel">
                                <h3>{panelConfig.name || `Unknown Panel: ${panelConfig.panel_type}`}</h3>
                                <p className="empty-state-message">Configuration error or unknown panel type.</p>
                            </div>
                        );
                }
            });
            setRenderedPanelsList(panelsToRender);
        } else {
            setRenderedPanelsList([
                <UpcomingMissionsPanel key="default-upcoming" activeTagFilters={activeTagFilters} title="Upcoming Missions"/>,
                <TodaysHabitsPanel key="default-todayhabits" activeTagFilters={activeTagFilters} title="Today's Habits"/>,
                <MissionPoolPanel key="default-pool" activeTagFilters={activeTagFilters} title="Mission Pool"/>
            ]);
        }
    }, [currentUser?.settings?.dashboard_panels, activeTagFilters]);
    
    return (
        <div className="page-container dashboard-page" style={{maxWidth: '1200px', margin: '0 auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Dashboard</h2>
            </div>
            <p style={{marginBottom: '2rem'}}>Welcome back, {userName}! Ready for your next Quest?</p>
            
            {currentUser?.settings?.dashboard_panels && currentUser.settings.dashboard_panels.filter(p=>p.is_active).length === 0 && (
                 <div className="dashboard-panel" style={{textAlign: 'center'}}>
                    <p>Your dashboard is empty!</p>
                    <Link to="/settings" className="auth-button" style={{textDecoration:'none', display:'inline-block', marginTop:'1rem'}}>Configure Dashboard Panels</Link>
                </div>
            )}

            <div className="dashboard-panels-flow-container"> 
                {renderedPanelsList}
            </div>
        </div>
    );
}

export default DashboardPage;