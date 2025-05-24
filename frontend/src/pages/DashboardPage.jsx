// frontend/src/pages/DashboardPage.jsx
import React, { useContext } from 'react'; // Removed useState for now
import { Link } from 'react-router-dom';
// import { UserContext } from '../contexts/UserContext'; // Not directly used here for now
import MissionPoolPanel from '../components/dashboard/MissionPoolPanel';
import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel'; 
import UpcomingMissionsPanel from '../components/dashboard/UpcomingMissionsPanel'; // Import new panel

import '../App.css'; 
import '../styles/dashboard.css'; 

function DashboardPage({ activeTagFilters }) { // Accept activeTagFilters as a prop
    const userString = localStorage.getItem('currentUser'); // Could also get from UserContext
    const user = userString ? JSON.parse(userString) : { name: 'Adventurer' };
    
    return (
        <div className="page-container dashboard-page" style={{maxWidth: '1200px', margin: '0 auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Dashboard</h2>
                {/* Global "Add New" button will be part of LeftSidebar, triggered by modal */}
            </div>
            <p style={{marginBottom: '2rem'}}>Welcome back, {user.name}! Ready for your next Quest?</p>
            
            <div className="dashboard-grid"> 
                <div className="dashboard-column main-column">
                    <UpcomingMissionsPanel activeTagFilters={activeTagFilters} />
                    <TodaysHabitsPanel activeTagFilters={activeTagFilters} />
                </div>
                <div className="dashboard-column sidebar-column">
                    <MissionPoolPanel activeTagFilters={activeTagFilters} />
                </div>
            </div>

            {/* Quick nav links can be removed if sidebar nav is sufficient */}
            <div style={{marginTop: '3rem', textAlign: 'center', display: 'none'}}>
                <Link to="/quests" className="nav-link" style={{margin: '0 0.5rem', padding: '0.6em 1.2em', border: '1px solid var(--color-accent-gold)', borderRadius: '4px'}}>
                    Manage Quests
                </Link>
                <Link to="/tags" className="nav-link" style={{margin: '0 0.5rem', padding: '0.6em 1.2em', border: '1px solid var(--color-accent-gold)', borderRadius: '4px'}}>
                    Manage Tags
                </Link>
            </div>
        </div>
    );
}

export default DashboardPage;