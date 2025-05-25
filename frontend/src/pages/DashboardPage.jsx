// frontend/src/pages/DashboardPage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext'; //

// Implemented Panels
import MissionPoolPanel from '../components/dashboard/MissionPoolPanel'; //
import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel';  //
import ProximosPanel from '../components/dashboard/ProximosPanel'; 
import ProjectTasksPanel from '../components/dashboard/ProjectTasksPanel';
import TodaysAgendaPanel from '../components/dashboard/TodaysAgendaPanel';
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel';
import RescueMissionsPanel from '../components/dashboard/RescueMissionsPanel';

// Placeholder Panels
import TodayLogbookEntriesPanel from '../components/dashboard/TodayLogbookEntriesPanel';
import HabitStatisticsPanel from '../components/dashboard/HabitStatisticsPanel';
import EnergyStatisticsPanel from '../components/dashboard/EnergyStatisticsPanel';


import '../App.css'; //
import '../styles/dashboard.css'; //

function DashboardPage({ activeTagFilters }) {
    const { currentUser } = useContext(UserContext); //
    const [renderedPanelsList, setRenderedPanelsList] = useState([]);
    const userName = currentUser?.name || 'Adventurer';

    useEffect(() => {
        if (currentUser?.settings?.dashboard_panels) {
            const activePanelConfigs = currentUser.settings.dashboard_panels
                .filter(panel => panel.is_active)
                .sort((a, b) => a.order - b.order);

            const panelsToRender = activePanelConfigs.map(panelConfig => {
                const panelComponentProps = { 
                    config: panelConfig,
                    activeTagFilters: activeTagFilters,
                    title: panelConfig.name 
                };

                switch (panelConfig.panel_type) {
                    case "UPCOMING_MISSIONS":
                        return <ProximosPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "MISSION_POOL":
                        return <MissionPoolPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "TODAY_HABITS":
                        return <TodaysHabitsPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "PROJECT_TASKS": 
                        return <ProjectTasksPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "TODAY_AGENDA":    
                        return <TodaysAgendaPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "RECENT_ACTIVITY":
                        return <RecentActivityPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "RESCUE_MISSIONS":
                        return <RescueMissionsPanel key={panelConfig.id} {...panelComponentProps} />;
                    // Placeholders
                    case "TODAY_LOGBOOK_ENTRIES":
                        return <TodayLogbookEntriesPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "HABIT_STATISTICS":
                        return <HabitStatisticsPanel key={panelConfig.id} {...panelComponentProps} />;
                    case "ENERGY_STATISTICS":
                        return <EnergyStatisticsPanel key={panelConfig.id} {...panelComponentProps} />;
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
            // Default panels if no configuration exists
            const defaultPanelProps = { activeTagFilters };
            setRenderedPanelsList([
                <ProximosPanel key="default-upcoming" {...defaultPanelProps} title="Upcoming Items"/>,
                <TodaysHabitsPanel key="default-todayhabits" {...defaultPanelProps} title="Today's Habits"/>,
                <MissionPoolPanel key="default-pool" {...defaultPanelProps} title="Mission Pool"/>
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