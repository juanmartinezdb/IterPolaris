// frontend/src/pages/DashboardPage.jsx
import React from 'react'; // , { useState } // useState para filtros de tags globales si se manejan aquí
import { Link } from 'react-router-dom';
import MissionPoolPanel from '../components/dashboard/MissionPoolPanel';
import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel'; 
// Importar otros paneles del dashboard cuando se creen (Tarea 9)
// import UpcomingMissionsPanel from '../components/dashboard/UpcomingMissionsPanel';
// import TodaysHabitsPanel from '../components/dashboard/TodaysHabitsPanel';

// Importar estilos globales de App.css o index.css si son necesarios aquí,
// o un dashboard.css específico. Por ahora, usamos page-container de App.css
import '../App.css'; // Para .page-container
import '../styles/dashboard.css'; // Crear este archivo para estilos del dashboard

function DashboardPage() {
    const userString = localStorage.getItem('currentUser');
    const user = userString ? JSON.parse(userString) : { name: 'Adventurer' }; // Placeholder
    
    // El estado de los filtros de tags (activeTagFilters) se manejará en el Layout principal (Tarea 9)
    // y se pasará como prop a los paneles que lo necesiten.
    // const [activeTagFilters, setActiveTagFilters] = useState([]);

    return (
        <div className="page-container dashboard-page" style={{maxWidth: '1200px', margin: '0 auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Dashboard</h2>
                {/* TODO Tarea 9: Botón "Add New" global */}
            </div>
            <p style={{marginBottom: '2rem'}}>Welcome back, {user.name}! Ready for your next Quest?</p>
            
            <div className="dashboard-grid"> 
                <div className="dashboard-column main-column"> {/* Columna principal */}
                    {/* <UpcomingMissionsPanel activeTagFilters={activeTagFilters} /> */}
                    <TodaysHabitsPanel /* activeTagFilters={activeTagFilters} */ />
                </div>
                <div className="dashboard-column sidebar-column"> {/* Columna lateral */}
                    <MissionPoolPanel 
                        /* activeTagFilters={activeTagFilters} */
                    />
                </div>
            </div>

            {/* Enlaces de navegación rápida (pueden eliminarse si están en la sidebar) */}
            <div style={{marginTop: '3rem', textAlign: 'center'}}>
                <Link to="/quests" className="nav-link" style={{margin: '0 0.5rem', padding: '0.6em 1.2em', border: '1px solid var(--color-accent-gold)', borderRadius: '4px'}}>
                    Manage Quests
                </Link>
                <Link to="/tags" className="nav-link" style={{margin: '0 0.5rem', padding: '0.6em 1.2em', border: '1px solid var(--color-accent-gold)', borderRadius: '4px'}}>
                    Manage Tags
                </Link>
                {/* <Link to="/calendar" className="nav-link">View Calendar</Link> */}
            </div>
        </div>
    );
}

export default DashboardPage;