// frontend/src/pages/DashboardPage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext'; 

// Import existing panel components (we'll create the new ones soon)
import MissionPoolPanel from '../components/dashboard/MissionPoolPanel';
import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel'; 
import UpcomingMissionsPanel from '../components/dashboard/UpcomingMissionsPanel';

// Placeholder components for new panels
const ProjectTasksPanelPlaceholder = ({ config }) => (
    <div className="dashboard-panel">
        <h3>{config.name || `Project: ${config.quest_id?.slice(0,8)}...`} (ProjectTasksPanel)</h3>
        <p className="empty-state-message">Project-specific content for Quest ID: {config.quest_id} will appear here.</p>
        <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
    </div>
);

const TodaysAgendaPanelPlaceholder = ({ config }) => (
    <div className="dashboard-panel">
        <h3>{config.name || "Today's Full Agenda"} (TodaysAgendaPanel)</h3>
        <p className="empty-state-message">Today's full agenda (all-day, habits, timed) will appear here.</p>
         <p style={{fontSize: '0.8em', textAlign: 'center', color: 'var(--color-text-on-dark-muted)'}}>(Panel Type: {config.panel_type}, Order: {config.order}, ID: {config.id})</p>
    </div>
);


import '../App.css'; 
import '../styles/dashboard.css'; 

function DashboardPage({ activeTagFilters }) {
    const { currentUser } = useContext(UserContext);
    const [renderedPanels, setRenderedPanels] = useState([]);

    const userName = currentUser?.name || 'Adventurer';

    useEffect(() => {
        if (currentUser?.settings?.dashboard_panels) {
            const activePanelConfigs = currentUser.settings.dashboard_panels
                .filter(panel => panel.is_active)
                .sort((a, b) => a.order - b.order);

            const panelsToRender = activePanelConfigs.map(panelConfig => {
                // Pass activeTagFilters to panels that need it
                const panelProps = { 
                    key: panelConfig.id, 
                    config: panelConfig, // Pass the whole config object
                    activeTagFilters: activeTagFilters 
                };

                switch (panelConfig.panel_type) {
                    case "UPCOMING_MISSIONS":
                        // UpcomingMissionsPanel was already designed to fetch its own data
                        // It might need to be adjusted if its title comes from panelConfig.name
                        return <UpcomingMissionsPanel {...panelProps} title={panelConfig.name} />;
                    case "MISSION_POOL":
                        // MissionPoolPanel also fetches its own data
                        return <MissionPoolPanel {...panelProps} title={panelConfig.name} />;
                    case "TODAY_HABITS":
                        // TodaysHabitsPanel also fetches its own data
                        return <TodaysHabitsPanel {...panelProps} title={panelConfig.name} />;
                    case "PROJECT_TASKS":
                        // This will be the new ProjectTasksPanel
                        return <ProjectTasksPanelPlaceholder {...panelProps} />;
                    case "TODAY_AGENDA":
                        // This will be the new TodaysAgendaPanel
                        return <TodaysAgendaPanelPlaceholder {...panelProps} />;
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
            setRenderedPanels(panelsToRender);
        } else {
            // Default panels if no configuration is found (optional)
            // Or show a message to configure the dashboard
            setRenderedPanels([
                <UpcomingMissionsPanel key="default-upcoming" activeTagFilters={activeTagFilters} title="Upcoming Missions"/>,
                <TodaysHabitsPanel key="default-todayhabits" activeTagFilters={activeTagFilters} title="Today's Habits"/>,
                <MissionPoolPanel key="default-pool" activeTagFilters={activeTagFilters} title="Mission Pool"/>
            ]);
        }
    }, [currentUser?.settings?.dashboard_panels, activeTagFilters]);
    
    // Simple grid layout for now: one column for main content, one for sidebar-like panels
    // This can be adjusted based on how many panels are active or specific panel properties
    const mainColumnPanels = renderedPanels.filter(panel => 
        panel.props.config?.panel_type === "UPCOMING_MISSIONS" || 
        panel.props.config?.panel_type === "TODAY_AGENDA" ||
        panel.props.config?.panel_type === "TODAY_HABITS" ||
        (panel.props.config?.panel_type === "PROJECT_TASKS" && panel.props.config?.order < 50) // Example: project tasks go to main if order is low
    );
     if (renderedPanels.length > 0 && mainColumnPanels.length === 0 && renderedPanels[0].props.config?.panel_type === "MISSION_POOL") {
        // If only Mission Pool is active, put it in the main column.
        mainColumnPanels.push(renderedPanels[0]);
    } else if (renderedPanels.length > 0 && mainColumnPanels.length === 0 && renderedPanels.length <=2) {
        // If only one or two panels and none fit the typical "main" criteria, put them all in main.
        renderedPanels.forEach(p => mainColumnPanels.push(p));
    }


    const sidebarColumnPanels = renderedPanels.filter(panel => 
        panel.props.config?.panel_type === "MISSION_POOL" && !mainColumnPanels.includes(panel) || // Only if not already in main
        (panel.props.config?.panel_type === "PROJECT_TASKS" && panel.props.config?.order >= 50 && !mainColumnPanels.includes(panel))
    );
     // If no panels fit sidebar criteria but there are panels not in main, put them in sidebar
    if (sidebarColumnPanels.length === 0 && renderedPanels.length > mainColumnPanels.length) {
        renderedPanels.forEach(p => {
            if (!mainColumnPanels.find(mp => mp.key === p.key)) {
                sidebarColumnPanels.push(p);
            }
        });
    }
    
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

            <div className="dashboard-grid"> 
                {mainColumnPanels.length > 0 && (
                    <div className="dashboard-column main-column">
                        {mainColumnPanels}
                    </div>
                )}
                {sidebarColumnPanels.length > 0 && (
                    <div className="dashboard-column sidebar-column">
                        {sidebarColumnPanels}
                    </div>
                )}
                 {/* Fallback if columns are empty but panels exist (e.g., all panels don't fit criteria) */}
                 {mainColumnPanels.length === 0 && sidebarColumnPanels.length === 0 && renderedPanels.length > 0 && (
                     <div className="dashboard-column main-column">
                        {renderedPanels}
                    </div>
                 )}
            </div>
        </div>
    );
}

export default DashboardPage;